const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');
const fs = require("fs");

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    prefix: ['pf', 'Pass fix', 'string']
});

let isCompleted = false;
let nextToken = undefined;

async function discribeAlarms() {
    let alarmsArray = [];
    await awsConfigHelper.updateConfig(cliArgs.region);
    const cloudwatch = new AWS.CloudWatch();
    while (!isCompleted) {
        try {
            const response = await cloudwatch.describeAlarms({
                NextToken: nextToken
            }).promise();
            if (response.MetricAlarms) {
                let alarmNames = response.MetricAlarms.map((metricAlarm) => {
                    return metricAlarm.AlarmName
                });
                alarmsArray = alarmsArray.concat(alarmNames);
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
    if (fs.existsSync("extract_cloudwatch_alarms.csv")) {
        fs.unlinkSync("extract_cloudwatch_alarms.csv");
    }
    fs.appendFileSync("extract_cloudwatch_alarms.csv","Alarm Name" + ",Action"+"\n");
    for (var i = 0; i < alarmsArray.length; i++) {
        fs.appendFileSync("extract_cloudwatch_alarms.csv", alarmsArray[i] + ",<Mention Column>" + "\n");
    }
}

discribeAlarms();