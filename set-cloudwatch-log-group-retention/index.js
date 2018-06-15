const AWS = require('aws-sdk');
const cloudwatchLogs = new AWS.CloudWatchLogs();

function setRetentionOfCloudwatchLogGroup(logGroupName, duration) {
    let params = {
        logGroupName : logGroupName,
        retentionInDays: duration
    };
    return cloudwatchLogs.putRetentionPolicy(params).promise();
}

exports.handler = async (event) => {
    const logGroupName = event.logGroupName ? event.logGroupName : event.detail.requestParameters.logGroupName;
    try {
        await setRetentionOfCloudwatchLogGroup(logGroupName, 14);
        console.log('Retention has been set to ' + logGroupName + 'for 2 weeks');
        return;
    } catch(error) {
        console.error(error);
        throw error;
    }
};