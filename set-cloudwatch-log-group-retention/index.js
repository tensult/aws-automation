const AWS = require('aws-sdk');
const cloudwatchLogs = new AWS.CloudWatchLogs();

function describeLogGroup(logGroupName) {
    return cloudwatchLogs.describeLogGroups({
        limit: 1,
        logGroupNamePrefix: logGroupName
    }).promise()
}

function setRetentionOfCloudwatchLogGroup(logGroupName, duration) {
    const params = {
        logGroupName: logGroupName,
        retentionInDays: duration
    };
    return cloudwatchLogs.putRetentionPolicy(params).promise();
}

exports.handler = async (event) => {
    const logGroupName = event.logGroupName ? event.logGroupName : event.detail.requestParameters.logGroupName;
    try {
        const logGroupInfo = await describeLogGroup(logGroupName);
        if (logGroupInfo.logGroups[0].retentionInDays) {
            console.log('Found retentionInDays set and so not setting retention');
            return;
        }
        await setRetentionOfCloudwatchLogGroup(logGroupName, 14);
        console.log('Retention has been set to ' + logGroupName + ' for 2 weeks');
        return;
    } catch (error) {
        throw error;
    }
};