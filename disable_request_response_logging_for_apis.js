/**
 * Enable all ApiGateway Apis logging to CloudWatch
 * After enabling logging, log level will be INFO
 */

const AWS = require('aws-sdk');
const wait = require('./util/wait');
const cli = require('cli');
const awsConfigHelper = require('./util/awsConfigHelper');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string']
});

if (!cliArgs.region) {
    cli.getUsage();
}

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
        restApiId, /* required */
        stageName
    };
    return ApiGateway.createDeployment(params).promise();
}

function updateStage(restApiId, stageName) {
    const params = {
        restApiId, /* required */
        stageName, /* required */
        patchOperations: [
            {
                op: 'replace',
                path: '/*/*/logging/dataTrace',
                value: "false"
            }
        ]
    };
    return ApiGateway.updateStage(params).promise();
}

function hasRequestLoggingEnabled(stage) {
    if (isEmpty(stage.methodSettings) || !stage.methodSettings['*/*'].dataTraceEnabled) {
        return false;
    }
    return true;
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
        restApiId, /* required */
    };
    return ApiGateway.getStages(params).promise();
}

async function disableRequestLogging() {
    try {
        await awsConfigHelper.updateConfig(cliArgs.region);
        ApiGateway = new AWS.APIGateway();
        const restApis = await getRestApis();
        for (let i = 0; i < restApis.items.length; i++) {
            const stages = await getStages(restApis.items[i].id);
            console.log(`Rest API id is ${restApis.items[i].id} | ${restApis.items[i].name}`);
            for (let j = 0; j < stages.item.length; j++) {
                const hasLoggingEnabled = hasRequestLoggingEnabled(stages.item[j]);
                console.log('Request and Response logging enable status: ', hasLoggingEnabled);
                if (!hasLoggingEnabled) {
                    continue;
                }
                const restApiId = restApis.items[i].id;
                const stageName = stages.item[j].stageName;
                console.log(`Disabling request logging for restapi id: ${restApiId} | ${restApis.items[i].name} and stage: ${stageName}`);
                await updateStage(restApiId, stageName);
                await wait(1000);
            }
        }
    } catch (err) {
        console.log(err);
    }
}

disableRequestLogging();