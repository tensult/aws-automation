const ec2 = require('./ec2');
// const lb = require('./elb');
const s3 = require('./s3');

async function configureAwsProfile(roleArn, externalId, region) {
    try {
        const AWS = require('aws-sdk');
        if (roleArn && roleArn.trim() !== '') {
            console.log('found roleArn');
            const sts = new AWS.STS();
            const params = {
                DurationSeconds: 3600,
                RoleArn: roleArn,
                RoleSessionName: "Bob"
            };
            if (externalId && externalId.trim() !== '') {
                params.ExternalId = externalId;
            }
            const stsAssumeRoleResponse = await sts.assumeRole(params).promise();
            AWS.config.update({
                accessKeyId: stsAssumeRoleResponse.Credentials.AccessKeyId,
                secretAccessKey: stsAssumeRoleResponse.Credentials.SecretAccessKey,
                sessionToken: stsAssumeRoleResponse.Credentials.SessionToken
            });
        }
        if (region) {
            AWS.config.update({
                region: region
            });
        }
        return AWS;
    } catch (error) {
        throw error;
    }
}

/**
 * 
 * @param {*} resources {"s3": ["bucket-name-1","bucket-name-2"], "ec2": ["i-sdfsdf21", "vol-fwfddwf", "sg-dsfsd"] }
 * @param {*} tags [{"Key": "demoKey", "Value": "demoValue"}]
 * @param {*} region 
 * @param {*} roleArn 
 * @param {*} externalId 
 */
async function handler(resources, tags, region, roleArn, externalId) {
    try {
        if (!resources || !tags || !region) {
            throw new Error("Pass required values - resourceIds(['i-a123sd', 'vol-aff2123', 'sg-qdqe1232', ...]), tags([{Key:'sdad', Value: 'dd'}, ...]), region");
        }
        const AWS = await configureAwsProfile(roleArn, externalId, region);
        await Promise.all([ec2.addTagsToEc2Resources(AWS, resources.ec2, tags),
            s3.addTagsToS3Buckets(AWS, resources.s3, tags)
        ]);
    } catch (error) {
        throw error;
    }
}
// handler(['i-sfsfg', 'vol-afafsf', 'i-01dc72751bb497ce3'], [{
//     Key: 'demokey',
//     Value: 'demovalue'
// }], 'ap-south-1');

module.exports = {
    handler: handler
};