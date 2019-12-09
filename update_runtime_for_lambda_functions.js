/**
 * Setting proper RunTime for lambda functions is important as it will have direct
 * impact on the performance and cost. 
 *
 * We can use this script to set RunTime for all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    runTime: ['v', 'Function Run time', 'string']
});

if (!cliArgs.region) {
    cli.getUsage();
}

const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function setFunctionRunTime() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const lambda = new AWS.Lambda();
    while (!isCompleted) {
        try {
            const response = await lambda.listFunctions({
                Marker: nextToken
            }).promise();
            if (response.Functions) {
                for (let i = 0; i < response.Functions.length; i++) {
                    const fn = response.Functions[i];
                    if (fn.Runtime === cliArgs.runTime) {
                        continue;
                    }
                    if (cliArgs.filterName && !fn.FunctionName.match(filterRegex)) {
                        continue;
                    }
                    console.log(`Setting RunTime to ${cliArgs.runTime} for function: ${fn.FunctionName}`);
                    await lambda.updateFunctionConfiguration({
                        FunctionName: fn.FunctionName,
                        Runtime: cliArgs.runTime
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
setFunctionRunTime();