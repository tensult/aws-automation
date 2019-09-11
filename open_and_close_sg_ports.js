const AWS = require('aws-sdk');
const sts = new AWS.STS();

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

async function handleOpeningAndClosingPorts(inputObj) {
    try {
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

        if (!action || !roleArn || (!publicIp && !privateIp) || !fromPort || !ipProtocol || (!cidrIp && !sourceSgId) || !toPort) {
            throw new Error('Required values missing!!');
        }

        const assumeRoleRes = await getAssumeRoleByRoleArn(roleArn);
        AWS.config.update({
            accessKeyId: assumeRoleRes.Credentials.AccessKeyId,
            secretAccessKey: assumeRoleRes.Credentials.SecretAccessKey,
            sessionToken: assumeRoleRes.Credentials.SessionToken
        });
        const ec2Obj = new AWS.EC2();
        const describeEc2InstanceRes = await describeEc2Instance(ec2Obj, publicIp);
        sgIds = describeEc2InstanceRes.Reservations[0].Instances[0].SecurityGroups.map(sg => sg.GroupId);
        console.log(sgIds);
        const describeSgsRes = await describeSgs(ec2Obj, sgIds);
        if (action === 'close') {
            for (const sg of describeSgsRes.SecurityGroups) {
                for (const ipPermission of sg.IpPermissions) {
                    if (cidrIp && ipPermission.FromPort === fromPort && ipPermission.ToPort === toPort && ipPermission.IpRanges.length > 0) {
                        for (const ipRange of ipPermission.IpRanges) {
                            if (ipRange.CidrIp === cidrIp) {
                                await revokeSecurityGroupIngress(ec2Obj, sg.GroupId, ipRange.CidrIp, undefined, fromPort, toPort, ipProtocol);
                                console.log('Yooooooooooo..... revoked security group ingress');
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
                console.log('Yooooooooooo..... authorized security group ingress');
            }
        }

    } catch (error) {
        throw error;
    }
}

exports.handler = async (event) => {
    try {
        await handleOpeningAndClosingPorts(event);
    } catch (error) {
        throw error;
    }
}