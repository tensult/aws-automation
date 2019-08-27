/**
 * Setting proper retention period for CloudWatch log groups is important 
 * as it is quite costly to keep the logs forever and by default CloudWatch 
 * log groups retention is set to Never expire.
 *
 * We can use this script to set retention for all our log groups at once.
 * You can know more about CloudWatch log group retention here: 
 * https://medium.com/tensult/manage-aws-cloudwatch-log-group-retention-using-automation-26add478b0c5
 * 
 * Command:
 * set AWS environment variables using: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
 * then execute following:
 * node update_cloudwatch_log_group_retention.js -r <aws-region> -l <logGroupNamePrefix> -R <retention-period-in-days>
 * Set only if retention is unset:
 * node update_cloudwatch_log_group_retention.js -r <aws-region> -l <logGroupNamePrefix> -R <retention-period-in-days> -s
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    logGroupPrefix: ['l', 'Log group prefix', 'string'],
    retention: ['R', 'Log group retention period in days', 'number', '14'],
    setOnlyIfUnset: ['s', 'Set Log group retention period only if unset', 'boolean'],
});

if (!cliArgs.region) {
    cli.getUsage();
}

async function setLogGroupRetention() {
    await awsConfigHelper.updateConfig(cliArgs.region);
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
                    if (logGroup.retentionInDays === cliArgs.retention ||
                        (cliArgs.setOnlyIfUnset && logGroup.retentionInDays)) {
                        continue;
                    }
                    console.log(`Setting retention period of ${cliArgs.retention} day for log group: ${logGroup.logGroupName}`);

                    await cloudwatchLogs.putRetentionPolicy({
                        logGroupName: logGroup.logGroupName,
                        retentionInDays: cliArgs.retention
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
setLogGroupRetention();
