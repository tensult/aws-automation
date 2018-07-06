/**
 * Setting proper retention period for CloudWatch log groups is important 
 * as it is quite costly to keep the logs forever and by default CloudWatch 
 * log groups retention is set to Never expire.
 *
 * We can use this script to set retention for all our log groups at once.
 * You can know more about CloudWatch log group retention here: 
 * https://medium.com/tensult/manage-aws-cloudwatch-log-group-retention-using-automation-26add478b0c5
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    logGroupPrefix: ['l', 'Log group prefix', 'string'],
    retention: ['R', 'Log group retention period in days', 'number', '14']
});

if(!cliArgs.profile || !cliArgs.region) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const cloudwatchLogs = new AWS.CloudWatchLogs();

let isCompleted = false;
let nextToken = undefined;

async function setLogGroupRetention() {
    while (!isCompleted) {
        try {
            const response = await cloudwatchLogs.describeLogGroups({
                logGroupNamePrefix: cliArgs.logGroupPrefix,
                nextToken: nextToken
            }).promise();
            if (response.logGroups) {
                for (let i = 0; i < response.logGroups.length; i++) {
                    const logGroup = response.logGroups[i];
                    if (logGroup.retentionInDays === cliArgs.retention) {
                        continue;
                    }
                    console.log(`Setting retention period of ${cliArgs.retention} day for log group: ${logGroup.logGroupName}`);
                    await cloudwatchLogs.putRetentionPolicy({
                        logGroupName: logGroup.logGroupName,
                        retentionInDays: cliArgs.retention
                    }).promise();
                    await wait(500);
                }
                nextToken = response.LastEvaluatedTableName;
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
setLogGroupRetention();