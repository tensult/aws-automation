/**
 * Gets subscription filters of CloudWatch log groups.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    logGroupPrefix: ['l', 'Log group prefix', 'string']
});

if (!cliArgs.profile ||
    !cliArgs.region) {
    cli.getUsage();
}

async function getLogGroupSubscriptionFilter() {
    await awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);
    const cloudwatchLogs = new AWS.CloudWatchLogs();

    let isCompleted = false;
    let nextToken = undefined;
    while (!isCompleted) {
        try {
            const response = await cloudwatchLogs.describeLogGroups({
                logGroupNamePrefix: cliArgs.logGroupPrefix,
                nextToken: nextToken
            }).promise();
            if (response.logGroups) {
                for (let i = 0; i < response.logGroups.length; i++) {
                    const logGroup = response.logGroups[i];
                    console.log(`Getting subscription filter for log group: ${logGroup.logGroupName}`);
                    const subscriptionFiltersResponse = await cloudwatchLogs.describeSubscriptionFilters({
                        logGroupName: logGroup.logGroupName
                    }).promise();
                    console.log(JSON.stringify(subscriptionFiltersResponse.subscriptionFilters, null, 2));
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
getLogGroupSubscriptionFilter();