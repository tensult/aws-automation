/**
 * Setting Alarm for Lambda function Errors is important as if
 * there is any bug in the code then it can trigger Lambda functions in loop and
 * it will effect the performance of the application also we will get huge AWS bill. 
 *
 * We can use this script to set Error Alarm for all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    duration: ['d', 'Duration for alarm to check errors', "number", 60],
    alarmActionArn: ['a', "Action to be trigger when alarm is breached", "string"],
    errorCount: ['c', 'Maximum errors in the specified duration', 'number', 1]
});

if (!cliArgs.region || !cliArgs.alarmActionArn) {
    cli.getUsage();
}

const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function setFunctionErrorAlarms() {
    await awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);
    const lambda = new AWS.Lambda();
    const cloudwatch = new AWS.CloudWatch();
    while (!isCompleted) {
        try {
            const response = await lambda.listFunctions({
                Marker: nextToken
            }).promise();
            if (response.Functions) {
                for (let i = 0; i < response.Functions.length; i++) {
                    const fn = response.Functions[i];
                    if (cliArgs.filterName && !fn.FunctionName.match(filterRegex)) {
                        console.log("Skipping function", fn.FunctionName);
                        continue;
                    }
                    console.log(`Creating Error Alarm for function: ${fn.FunctionName}`);
                    await cloudwatch.putMetricAlarm({
                        AlarmName: `${fn.FunctionName}_Error`,
                        AlarmDescription: "Errors Alarm",
                        Period: cliArgs.duration,
                        MetricName: "Errors",
                        ActionsEnabled: true,
                        AlarmActions: [
                            cliArgs.alarmActionArn
                        ],
                        Namespace: "AWS/Lambda",
                        Statistic: "Sum",
                        Dimensions: [{
                            "Name": "FunctionName",
                            "Value": fn.FunctionName
                        }],
                        EvaluationPeriods: 1,
                        DatapointsToAlarm: 1,
                        Threshold: cliArgs.errorCount,
                        ComparisonOperator: "GreaterThanOrEqualToThreshold",
                        TreatMissingData: "missing"
                    }).promise();
                    await wait(500);
                }
                nextToken = response.NextMarker;
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
setFunctionErrorAlarms();