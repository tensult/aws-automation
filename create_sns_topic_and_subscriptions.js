/**
 * 
 * @description This function creates a SNS topic and then create multiple emails subscription on that topic.
 * 
 * 
 * To run the function follow below command: 
 * AWS_PROFILE=<aws-profile> node create_sns_topic_and_subscriptions.js -r <aws-region> -t '<topic-name>' -d '<topic-display-name>' -s '<email_1>,<email_2>,..' 
 */

const AWS = require('aws-sdk');
const cli = require('cli');
const awsConfigHelper = require('./util/awsConfigHelper');
const awsUtil = require('./util/aws');

const cliArgs = cli.parse({
    region: ['r', 'AWSRegion', 'string'],
    topicName: ['t', 'TopicName', 'string'],
    topicDisplayName: ['d', 'TopicDisplayName', 'string'],
    subscriptionEnpoints: ['s', 'SubscriptionEndpoints', 'string'],
});

if (!cliArgs.region || !cliArgs.topicName || !cliArgs.topicDisplayName || !cliArgs.subscriptionEnpoints) {
    cli.getUsage();
}

function getTopicName() {
    return cliArgs.topicName;
}

function getTopicDisplayName() {
    return cliArgs.topicDisplayName;
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

function createTopic(sns, topicName, topicDisplayName) {
    const params = {
        Name: topicName,
        Attributes: {
            DisplayName: topicDisplayName
        }
    };
    console.log(params);
    return sns.createTopic(params).promise();
}

async function handler() {
    try {
        await awsConfigHelper.updateConfig(cliArgs.region);
        const sns = new AWS.SNS();
        const topicName = getTopicName();
        const topicDisplayName = getTopicDisplayName();
        const createdTopic = await createTopic(sns, topicName, topicDisplayName);
        const subscriptionEndpoints = getSubscriptionEndpoints();
        for (const subscriptionEndpoint of subscriptionEndpoints) {
            await createSubscription(sns, createdTopic.TopicArn, subscriptionEndpoint);
        }
    } catch (error) {
        console.error(error);
    }

}

handler();
