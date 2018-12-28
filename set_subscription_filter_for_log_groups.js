/**
 * Sets subscription filter for CloudWatch log groups so that LogEvents 
 * can be delivered to Lambda or Kinesis streams.
 *
 * We can use this script to set subscription filter for all our log groups at once.
*/
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    logGroupPrefix: ['l', 'Log group prefix', 'string'],
    filterPattern: ['P', 'Filter Pattern', 'string'],
    filterName: ['f', 'Filter Name', 'string', 'logFilter'],
    destinationArn: ['d', 'Destination ARN', 'string']
});

if (
    !cliArgs.region ||
    !cliArgs.destinationArn ||
    !cliArgs.filterPattern) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.region);


let isCompleted = false;
let nextToken = undefined;

async function setLogGroupSubscriptionFilter() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const cloudwatchLogs = new AWS.CloudWatchLogs();
    while (!isCompleted) {
        try {
            const response = await cloudwatchLogs.describeLogGroups({
                logGroupNamePrefix: cliArgs.logGroupPrefix,
                nextToken: nextToken
            }).promise();
            if (response.logGroups) {
                for (let i = 0; i < response.logGroups.length; i++) {
                    const logGroup = response.logGroups[i];
                    console.log(`Setting subscription filter for log group: ${logGroup.logGroupName}`);
                    await cloudwatchLogs.putSubscriptionFilter({
                        logGroupName: logGroup.logGroupName,
                        destinationArn: cliArgs.destinationArn,
                        filterName: cliArgs.filterName,
                        filterPattern: cliArgs.filterPattern
                    }).promise();
                    await wait(500);
                }
                nextToken = response.nextToken;
                isCompleted = !nextToken;
            } else {
                isCompleted = true
            }
        } catch (error) {
            if (error.code === 'ThrottlingException') {
                await wait(2000);
            } else {
                throw error;
            }
        }
    }
}
setLogGroupSubscriptionFilter();