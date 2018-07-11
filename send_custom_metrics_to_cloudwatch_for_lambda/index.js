const AWS = require('aws-sdk');
const cloudWatch = new AWS.CloudWatch();
const Zlib = require('zlib');

// Get readable date from milliseconds
function getDate(dateInMS) {
    let date = new Date(dateInMS);
    return date.toISOString(); // "Dec 20"
}

// Send metrics to cloudwatch
function sendMetricData(metricData) {
    const params = {
        MetricData: metricData,
        Namespace: 'CustomLambdaMetrics' /* required */
    };
    return cloudWatch.putMetricData(params).promise();
}

// Get function name from log group name
function getFunctionName(logGroupName) {
    return logGroupName.split('/')[3];
}

/*
    message format "REPORT RequestId: faff6a71-7ea0-11e8-ac94-1710ce2fc493\tDuration: 1.79 ms\tBilled Duration: 100 ms \tMemory Size: 128 MB\tMax Memory Used: 46 MB\t\n"
*/
function getMetrics(message) {
    let metricData = {};
    if(message.indexOf('Billed Duration') === -1) {
        console.warn("Not a lambda usage report log so ignoring");
        return undefined;
    }
    const splitedMessage = message.split('\t');
    metricData.BilledDuration = parseFloat(splitedMessage[2].split(' ')[2]);
    metricData.ConfiguredMemorySize = parseFloat(splitedMessage[3].split(' ')[2]);
    metricData.UsedMemorySize = parseFloat(splitedMessage[4].split(' ')[3]);
    return metricData;
}

function prepareMetricsData(logData) {
    let metricsData = [];
    let metrics = getMetrics(logData.logEvents[0].message);
    if(!metrics) {
        return undefined;
    }
    metrics.BilledUnits = (metrics.ConfiguredMemorySize / 128) * (metrics.BilledDuration / 100);
    const metricNames = Object.keys(metrics);
    for (let i = 0; i < metricNames.length; i++) {
        let metricData = {};
        metricData.MetricName = metricNames[i];
        metricData.Dimensions = [{ Name: 'FunctionName', Value: getFunctionName(logData.logGroup) }];
        metricData.Timestamp = getDate(logData.logEvents[0].timestamp);
        if (metricNames[i] === 'BilledDuration') {
            metricData.Unit = 'Milliseconds';
            metricData.Value = metrics.BilledDuration;
        }
        else if (metricNames[i] === 'ConfiguredMemorySize') {
            metricData.Unit = 'Megabytes';
            metricData.Value = metrics.ConfiguredMemorySize;
        }
        else if (metricNames[i] === 'UsedMemorySize') {
            metricData.Unit = 'Megabytes';
            metricData.Value = metrics.UsedMemorySize;
        }
        else if (metricNames[i] === 'BilledUnits') {
            metricData.Unit = 'Count';
            metricData.Value = metrics.BilledUnits;
        }
        metricsData.push(metricData);
    }
    return metricsData;
}

// Get decoded object data from an base64 encoded gzip data
function getDecodedLogData(encodedData) {
    const payload = new Buffer(encodedData, 'base64');
    return JSON.parse(Zlib.gunzipSync(payload).toString('ascii'));
}

exports.handler = async (event) => {
    try {
        const decodedLogData = getDecodedLogData(event.awslogs.data);
        const preparedMetricsData = prepareMetricsData(decodedLogData);
        if(!preparedMetricsData) {
            return;
        }
        console.log('Starting metric sending task for lambda function: ', getFunctionName(decodedLogData.logGroup));
        const sentMetricData = await sendMetricData(preparedMetricsData);
        console.log(sentMetricData);
        return;
    } catch (err) {
        console.log(err);
    }
}