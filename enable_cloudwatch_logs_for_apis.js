/**
 * Enable all ApiGateway Apis logging to CloudWatch
 * After enabling logging, log level will be INFO
 */

const AWS = require('aws-sdk');
const wait = require('./util/wait');
const cli = require('cli');
const awsConfigHelper = require('./util/awsConfigHelper');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    logLevel: ['l', 'Log level', 'string', 'INFO']
});

if (!cliArgs.region) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.region);

let ApiGateway;

function isEmpty(obj) {
    for (let prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

// Deploy api to stage
function createDeployment(restApiId, stageName) {
    var params = {
        restApiId,
        /* required */
        stageName
    };
    return ApiGateway.createDeployment(params).promise();
}

function updateStage(restApiId, stageName) {
    const params = {
        restApiId,
        /* required */
        stageName,
        /* required */
        patchOperations: [{
            op: 'replace',
            path: '/*/*/logging/loglevel',
            value: cliArgs.logLevel
        }]
    };
    return ApiGateway.updateStage(params).promise();
}

// Check log level is given log level or not
function checkLogLevel(stage) {
    if (!isEmpty(stage.methodSettings) && stage.methodSettings['*/*'].loggingLevel === cliArgs.logLevel) {
        return true;
    }
    return false;
}

function getRestApis() {
    const params = {
        // limit: 0,
        // position: 'STRING_VALUE'
    };
    return ApiGateway.getRestApis(params).promise();
}

// Get info anout stage resource of api
function getStages(restApiId) {
    const params = {
        restApiId,
        /* required */
    };
    return ApiGateway.getStages(params).promise();
}

async function enableCloudWatchLogsHandler() {

    try {
        await awsConfigHelper.updateConfig(cliArgs.region);
        ApiGateway = new AWS.APIGateway();
        const restApis = await getRestApis();
        console.log('Rest APIs: ', restApis);
        for (let i = 0; i < restApis.items.length; i++) {
            const stages = await getStages(restApis.items[i].id);
            console.log(`Rest API id is ${restApis.items[i].id} and stages: ${JSON.stringify(stages)}`);
            for (let j = 0; j < stages.item.length; j++) {
                const isLogLevelCorrect = checkLogLevel(stages.item[j]);
                console.log('Log level status: ', isLogLevelCorrect);
                if (isLogLevelCorrect) {
                    continue;
                }
                const restApiId = restApis.items[i].id;
                const stageName = stages.item[j].stageName;
                console.log(`Setting logLevel=${cliArgs.logLevel} for restapi id: ${restApiId} and stage: ${stageName}`);
                await updateStage(restApiId, stageName);
                await wait(1000);
            }
        }
    } catch (err) {
        console.log(err);
    }
}

enableCloudWatchLogsHandler();