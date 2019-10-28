/**
 * 
 * @description
 * This script helps to open and close ec2 instance security group port
 * 
 * How to use this script: - 
 * 
 * Install node and npm in your machine
 * 
 * Configure AWS profile in your machine
 * https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html
 * 
 * Run the following commands to execute this script - 
 * $ npm i aws-sdk
 * $ IS_LOGGING_ALLOWED=1 INPUT_DATA="{\"publicIp\":\"<publicIp>\",\"fromPort\":\"<fromPort>\",\"ipProtocol\":\"<ipProtocol>\",\"cidrIp\":\"<cidrIp>\",\"toPort\":\"<toPort>\",\"action\":\"open\",\"region\":\"<region>\",\"description\":\"<description>\"}" AWS_PROFILE=<AWS_PROFILE> node open_and_close_sg_ports.js
 * 
 * 
 */

const AWS = require('aws-sdk');
const sts = new AWS.STS();

const {
    INPUT_DATA,
    IS_LOGGING_ALLOWED
} = process.env;

function logging(...s) {
    if (IS_LOGGING_ALLOWED > '0') {
        console.log(...s);
    }
}

function revokeSecurityGroupIngress(ec2Obj, GroupId, CidrIp, sourceSg, FromPort, ToPort, IpProtocol) {
    const params = {};
    if (CidrIp) {
        params.GroupId = GroupId;
        params.CidrIp = CidrIp;
        params.FromPort = FromPort;
        params.ToPort = ToPort;
        params.IpProtocol = IpProtocol;
    }
    if (sourceSg) {
        params.GroupId = GroupId;
        params.IpPermissions = [{
            FromPort,
            ToPort,
            IpProtocol,
            UserIdGroupPairs: [{
                GroupId: sourceSg,
            }]
        }]
    }
    return ec2Obj.revokeSecurityGroupIngress(params).promise();
}

function describeSgs(ec2Obj, sgIds) {
    const params = {
        GroupIds: sgIds
    };
    return ec2Obj.describeSecurityGroups(params).promise();
}

function authorizeSecurityGroupIngress(ec2Obj, sgId, CidrIp, sourceSgId, IpProtocol, FromPort, ToPort, description) {
    const params = {};
    if (CidrIp) {
        params.GroupId = sgId;
        params.IpPermissions = [{
            FromPort,
            IpProtocol,
            IpRanges: [{
                CidrIp,
                Description: (description ? description : '')
            }],
            ToPort
        }]
    }
    if (sourceSgId) {
        params.GroupId = sgId;
        params.IpPermissions = [{
            FromPort,
            IpProtocol,
            ToPort,
            UserIdGroupPairs: [{
                GroupId: sourceSgId
            }]
        }];
    }
    return ec2Obj.authorizeSecurityGroupIngress(params).promise();
}

function describeEc2Instance(ec2Obj, publicIp, privateIp) {
    const params = {
        Filters: [],
    };
    if (publicIp) {
        params.Filters.push({
            Name: 'ip-address',
            Values: [publicIp]
        })
    }
    if (privateIp) {
        params.Filters.push({
            Name: 'private-ip-address',
            Values: [privateIp]
        })
    }
    return ec2Obj.describeInstances(params).promise();
}

function getAssumeRoleByRoleArn(roleArn) {
    const params = {
        RoleArn: roleArn,
        RoleSessionName: "Bob"
    };
    return sts.assumeRole(params).promise();
}

async function handleOpeningAndClosingPorts() {
    try {

        const inputObj = JSON.parse(INPUT_DATA);
        logging('Input object ', inputObj);

        const region = inputObj.region;
        const action = inputObj.action;
        const roleArn = inputObj.roleArn;
        const publicIp = inputObj.publicIp;
        const privateIp = inputObj.privateIp;
        const fromPort = inputObj.fromPort;
        const ipProtocol = inputObj.ipProtocol;
        const cidrIp = inputObj.cidrIp;
        const toPort = inputObj.toPort;
        const description = inputObj.description;
        const sourceSgId = inputObj.sourceSgId;

        let sgIds = (!inputObj.sgs || inputObj.sgs.length === 0) ? undefined : inputObj.sgs;
        if (!action || (!publicIp && !privateIp) || !fromPort || !ipProtocol || (!cidrIp && !sourceSgId) || !toPort) {
            throw new Error('Required values missing!!');
        }
        // const assumeRoleRes = await getAssumeRoleByRoleArn(roleArn);
        // AWS.config.update({
        //     accessKeyId: assumeRoleRes.Credentials.AccessKeyId,
        //     secretAccessKey: assumeRoleRes.Credentials.SecretAccessKey,
        //     sessionToken: assumeRoleRes.Credentials.SessionToken
        // });
        const ec2Obj = new AWS.EC2({
            region
        });
        const describeEc2InstanceRes = await describeEc2Instance(ec2Obj, publicIp);
        if (describeEc2InstanceRes.Reservations.length === 0) {
            throw new Error('No instance found in the region');
        }
        // logging('describeEc2InstanceRes', describeEc2InstanceRes);
        sgIds = describeEc2InstanceRes.Reservations[0].Instances[0].SecurityGroups.map(sg => sg.GroupId);
        logging('Fetched SGs ', sgIds);
        const describeSgsRes = await describeSgs(ec2Obj, sgIds);
        logging('Fetched SGs description ', describeSgsRes);
        if (action === 'close') {
            for (const sg of describeSgsRes.SecurityGroups) {
                logging('got sg ', sg);
                for (const ipPermission of sg.IpPermissions) {
                    logging('got ipPermission ', ipPermission);
                    logging(cidrIp, ipPermission.FromPort === parseInt(fromPort), ipPermission.ToPort === parseInt(toPort), ipPermission.IpRanges.length > 0);
                    if (cidrIp && ipPermission.FromPort === parseInt(fromPort) && ipPermission.ToPort === parseInt(toPort) && ipPermission.IpRanges.length > 0) {
                        logging('condition passed');
                        for (const ipRange of ipPermission.IpRanges) {
                            if (ipRange.CidrIp === cidrIp) {
                                await revokeSecurityGroupIngress(ec2Obj, sg.GroupId, ipRange.CidrIp, undefined, fromPort, toPort, ipProtocol);
                                logging('Yooooooooooo..... revoked security group ingress');
                            }
                        }
                    }
                    if (sourceSgId && ipPermission.FromPort === fromPort && ipPermission.ToPort === toPort && ipPermission.UserIdGroupPairs.length > 0) {
                        for (const userIdGroupPair of ipPermission.UserIdGroupPairs) {
                            if (userIdGroupPair.GroupId === sourceSgId) {
                                await revokeSecurityGroupIngress(ec2Obj, sg.GroupId, undefined, userIdGroupPair.GroupId, fromPort, toPort, ipProtocol);
                                console.log('Yooooooooooo..... revoked security group ingress');
                            }
                        }
                    }
                }
            }
        }
        if (action === 'open') {
            for (const sg of describeSgsRes.SecurityGroups) {
                await authorizeSecurityGroupIngress(ec2Obj, sg.GroupId, cidrIp, sourceSgId, ipProtocol, fromPort, toPort, description);
                logging('Yooooooooooo..... authorized security group ingress');
            }
        }
    } catch (error) {
        throw error;
    }
}

handleOpeningAndClosingPorts();