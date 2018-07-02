const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['R', 'AWS region', 'string'],
    logGroupPrefix: ['l', 'Log group prefix', 'string'],
    retention: ['r', 'Log group retention period in days', 'number']
});

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const cloudwatchLogs = new AWS.CloudWatchLogs();

let isCompleted = false;
let nextToken = undefined;

async function setLogGroupRetention() {
    while (!isCompleted) {
        const response = await cloudwatchLogs.describeLogGroups({
            logGroupNamePrefix: cliArgs.logGroupPrefix,
            nextToken: nextToken
        }).promise();
        if (response.logGroups) {
            for (l = 0; l < response.logGroups.length; l++) {
                const logGroup = response.logGroups[l];
                if(logGroup.retentionInDays === cliArgs.retention) {
                    continue;
                }
                console.log("Setting retention for", logGroup.logGroupName);
                await cloudwatchLogs.putRetentionPolicy({
                    logGroupName: logGroup.logGroupName,
                    retentionInDays: cliArgs.retention
                }).promise();
            }
        }
        nextToken = response.nextToken;
        isCompleted = !nextToken;
    }
}
setLogGroupRetention();