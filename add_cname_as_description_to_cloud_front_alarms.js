// To run:
// AWS_PROFILE=<aws-profile> node add_cname_as_description_to_cloud_front_alarms.js
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

let cloudwatch = null;

function isCloudFrontAlarm(alarm) {
    return alarm.Dimensions && alarm.Dimensions.find((dim) => {
        return dim.Name === "DistributionId";
    });
}

function getDistributionIdFromAlarm(alarm) {
    const distribution = alarm.Dimensions.find((dim) => {
        return dim.Name === "DistributionId";
    });
    return distribution.Value;
}

async function getCloudFrontAlarms() {
    await awsConfigHelper.updateConfig("us-east-1");
    cloudwatch = new AWS.CloudWatch();
    let alarms = [];
    let nextToken = null;
    do {
        const alarmsResponse = await cloudwatch.describeAlarms(
            { NextToken: nextToken }).promise();
        if (alarmsResponse && alarmsResponse.MetricAlarms) {
            alarmsResponse.MetricAlarms.forEach((alarm) => {
                if (isCloudFrontAlarm(alarm)) {
                    alarms.push(alarm);
                }
            });
            nextToken = alarmsResponse.NextToken;
        }
    } while (nextToken);
    return alarms;
}

async function getCloudFrontDistributions() {
    await awsConfigHelper.updateConfig("us-east-1");
    const cloudFront = new AWS.CloudFront();
    let distributions = [];
    let nextToken = null;

    do {
        nextToken = null;
        const distributionsResponse = await cloudFront.listDistributions(
            { Marker: nextToken }).promise();
        if (distributionsResponse &&
            distributionsResponse.DistributionList &&
            distributionsResponse.DistributionList.Items
        ) {
            distributionsResponse.DistributionList.Items.forEach((distribution) => {
                distributions[distribution.Id] = distribution;
            });
            nextToken = distributionsResponse.DistributionList.NextMarker;
        }
    } while (nextToken);
    return distributions;
}

async function setDescriptionForCloudFrontAlarms() {
    const cloudFrontAlarms = await getCloudFrontAlarms();
    const cloudFrontDistributions = await getCloudFrontDistributions();
    for (const cloudFrontAlarm of cloudFrontAlarms) {
        const distributionId = getDistributionIdFromAlarm(cloudFrontAlarm);
        cloudFrontAlarm.EvaluationPeriods = 2;
        cloudFrontAlarm.DatapointsToAlarm = 2;
        cloudFrontAlarm.Threshold = 5;
        cloudFrontAlarm.AlarmDescription = cloudFrontDistributions[distributionId].Aliases ?
            cloudFrontDistributions[distributionId].Aliases.Items.join(", ") : undefined;
        delete cloudFrontAlarm.AlarmArn;
        delete cloudFrontAlarm.AlarmConfigurationUpdatedTimestamp;
        delete cloudFrontAlarm.StateValue;
        delete cloudFrontAlarm.StateReason;
        delete cloudFrontAlarm.StateReasonData;
        delete cloudFrontAlarm.StateUpdatedTimestamp;
        delete cloudFrontAlarm.Metrics;
        console.log("setting for", cloudFrontAlarm.AlarmName);
        await cloudwatch.putMetricAlarm(cloudFrontAlarm).promise();
        await wait(1000);
    }
}

setDescriptionForCloudFrontAlarms();

