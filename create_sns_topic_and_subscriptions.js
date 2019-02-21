/**
 * 
 * @description This function creates a SNS topic and then create multiple emails subscription on that topic.
 * 
 * 
 * To run the function follow below command: 
 * AWS_PROFILE=<aws-profile> node create_sns_topic_and_subsciptions.js -r <aws-region> -t '<topic-name>' -s '<email_1>,<email_2>,..' 
 */

const AWS = require('aws-sdk');
const cli = require('cli');
const awsConfigHelper = require('./util/awsConfigHelper');
const awsUtil = require('./util/aws');

const cliArgs = cli.parse({
    region: ['r', 'AWSRegion', 'string'],
    topicName: ['t', 'TopicName', 'string'],
    subscriptionEnpoints: ['s', 'SubscriptionEndpoints', 'string'],
});

if (!cliArgs.region || !cliArgs.topicName || !cliArgs.subscriptionEnpoints) {
    cli.getUsage();
}

function getTopicName() {
    return cliArgs.topicName;
}

function getSubscriptionEndpoints() {
    return awsUtil.getStringArrayFromCommaSeperatedString(cliArgs.subscriptionEnpoints);
}

function createSubscription(sns, topicArn, subscriptionEndpoint) {
    const params = {
        Protocol: 'email',
        TopicArn: topicArn,
        Endpoint: subscriptionEndpoint
    };
    return sns.subscribe(params).promise();
}

function createTopic(sns, topicName) {
    const params = {
        Name: topicName,
    };
    return sns.createTopic(params).promise();
}

async function handler() {
    try {
        await awsConfigHelper.updateConfig(cliArgs.region);
        const sns = new AWS.SNS();
        const topicName = getTopicName();
        const createdTopic = await createTopic(sns, topicName);
        const subscriptionEndpoints = getSubscriptionEndpoints();
        for (const subscriptionEndpoint of subscriptionEndpoints) {
            await createSubscription(sns, createdTopic.TopicArn, subscriptionEndpoint);
        }
    } catch (error) {
        console.error(error);
    }

}

handler();