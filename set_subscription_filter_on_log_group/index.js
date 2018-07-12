const AWS = require('aws-sdk');
const cloudWatchLogs = new AWS.CloudWatchLogs();
const lambda = new AWS.Lambda()

// Get lambda function info by function name
function getLambdaFunctionInfo(lambdaFunctionName) {
    const params = {
        FunctionName: lambdaFunctionName
    };
    return lambda.getFunction(params).promise();
}

// Check log group of lambda or not
function isLambdaLogGroup(logGroupName) {
    if (logGroupName.startsWith('/aws/lambda')) {
        return true;
    }
    return false;
}

function createSubscriptionFilter(destinationArn, filterName, filterPattern, logGroupName) {
    var params = {
        destinationArn, /* required */
        filterName, /* required */
        filterPattern, /* required */
        logGroupName, /* required */
    };
    return cloudWatchLogs.putSubscriptionFilter(params).promise();
}

function isValidEvent(event) {
    return event &&
        event.detail.eventName === 'CreateLogGroup' &&
        isLambdaLogGroup(event.detail.requestParameters.logGroupName);
}

exports.handler = async (event) => {
    try {
        if (isValidEvent(event)) {
            const logGroupName = event.detail.requestParameters.logGroupName;
            const destinationLambdaFunctionName = process.env.destinationLambdaFunctionName;
            const destinationLambdaFunctionInfo = await getLambdaFunctionInfo(destinationLambdaFunctionName);
            const destinationLambdaFunctionARN = destinationLambdaFunctionInfo.Configuration.FunctionArn;
            const filterName = 'logFilter';
            const filterPattern = 'REPORT RequestId';
            console.log('Creating subscription filter for log group: ', event.detail.requestParameters.logGroupName)
            const createdSubscriptionFilter = await createSubscriptionFilter(destinationLambdaFunctionARN, filterName, filterPattern, logGroupName);
            console.log(JSON.stringify(createdSubscriptionFilter));
        }
        return;
    } catch (err) {
        if(err.code === 'ResourceNotFoundException') {
            console.log(err.message);
        }
        else {
            console.log(err);
        }
    }
}
