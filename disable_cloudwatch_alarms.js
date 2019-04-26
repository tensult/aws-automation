const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    prefix: ['pf', 'Pass fix', 'string']
});

console.log("test");

if (!cliArgs.region || ! cliArgs.prefix) {
    cli.getUsage();
}

let isCompleted = false;
let nextToken = undefined;

async function disableCloudWatchAlarm() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const cloudwatch = new AWS.CloudWatch();
    while (!isCompleted) {
        try {
            const response = await cloudwatch.describeAlarms({
                AlarmNamePrefix: prefix,
                NextToken: nextToken
            }).promise();
            if (response.MetricAlarms) {
                let alarmNames = response.MetricAlarms.map((metricAlarm) => {
                    return metricAlarm.AlarmName
                });
                await cloudwatch.disableAlarmActions({
                    AlarmNames: [alarmNames]
                }).promise();
                nextToken = response.NextToken;
                isCompleted = !nextToken;
            } else {
                isCompleted = true;
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

disableCloudWatchAlarm();
