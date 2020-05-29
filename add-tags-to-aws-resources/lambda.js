const addTagsToAwsResourcesHandler = require('./add_tags_to_aws_resources');

/**
 *
 * @param {*} event {"resources":{"s3": ["bucket-name-1","bucket-name-2"], "ec2": ["i-sdfsdf21", "vol-fwfddwf", "sg-dsfsd"] },"tags":[{"Key": "demoKey", "Value": "demoValue"}] }
 * 
 */
exports.handler = async (event) => {
    console.log('Received event\n', JSON.stringify(event, null, 2));
    try {
        await addTagsToAwsResourcesHandler.handler(event.resources, event.tags, event.region, event.roleArn, event.externalId);
    } catch (error) {
        throw error;
    }
};