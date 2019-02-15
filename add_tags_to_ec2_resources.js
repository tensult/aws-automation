/**
 * Adds tags to several AWS EC2 resources:
 * AWS_PROFILE=<aws-profile> node add_tags_to_ec2_resources.js -r ap-south-1 -R "i-1234,ami-1234" -t "key1=value1;key2=value2"
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const awsUtil = require('./util/aws');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    resourceIds: ['R', 'EC2 resource IDs comma separated', 'string'],
    tags: ['t', 'Tags: key1:value1;key2=value2', 'string']
});

if (!cliArgs.region || !cliArgs.resourceIds || !cliArgs.tags) {
    cli.getUsage();
}

async function addTagsToEC2Resources() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const ec2 = new AWS.EC2();

    const resourceIds = cliArgs.resourceIds.split(/\s*,\s*/);
    const tags = awsUtil.parseTagsKeyValueString(cliArgs.tags);
    console.log('Adding tags:', tags, 'to resources:', resourceIds);
    try {
        await ec2.createTags({ Resources: resourceIds, Tags: tags }).promise();
    } catch (error) {
        console.error('Failed to create tags', error);
    }

}
addTagsToEC2Resources();