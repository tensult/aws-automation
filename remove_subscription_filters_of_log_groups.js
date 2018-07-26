/**
 * Removes subscription filters of CloudWatch log groups.
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

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const cloudwatchLogs = new AWS.CloudWatchLogs();

async function getSubscriptionFilters(logGroupName) {
    let subscriptionFilters = [];
    let isCompleted = false;
    let marker = undefined;
    while (!isCompleted) {
        let response = await cloudwatchLogs.describeSubscriptionFilters({
            logGroupName: logGroupName,
            nextToken: marker
        }).promise();
        marker = response.nextToken;
        if (response.subscriptionFilters) {
            subscriptionFilters = subscriptionFilters.concat(response.subscriptionFilters);
            isCompleted = marker === undefined || marker === null;
        } else {
            isCompleted = true;
        }
        await wait(500);
    }
    return subscriptionFilters;
}

async function removeLogGroupSubscriptionFilters() {
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
                    let subscriptionFilters = await getSubscriptionFilters(logGroup.logGroupName);
                    for(let subscriptionFilter of subscriptionFilters) {
                        console.log(`Removing subscription filter: ${subscriptionFilter.filterName} of log group: ${logGroup.logGroupName}`);
                        await cloudwatchLogs.deleteSubscriptionFilter({
                            logGroupName: logGroup.logGroupName,
                            filterName: subscriptionFilter.filterName
                        }).promise();
                    }
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
removeLogGroupSubscriptionFilters();