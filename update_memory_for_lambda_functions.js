/**
 * Setting proper memory for lambda functions is important as it will have direct
 * impact on the performance and cost. 
 *
 * We can use this script to set memory for all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    memory: ['m', 'Function memory in MB', 'number', 128]
});

if (!cliArgs.profile || !cliArgs.region) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const lambda = new AWS.Lambda();
const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function setFunctionMemory() {
    while (!isCompleted) {
        try {
            const response = await lambda.listFunctions({
                Marker: nextToken
            }).promise();
            if (response.Functions) {
                for (let i = 0; i < response.Functions.length; i++) {
                    const fn = response.Functions[i];
                    if (fn.MemorySize === cliArgs.memory) {
                        continue;
                    }
                    if (cliArgs.filterName && !fn.FunctionName.match(filterRegex)) {
                        continue;
                    }
                    console.log(`Setting memory ${cliArgs.memory} MB for function: ${fn.FunctionName}`);
                    await lambda.updateFunctionConfiguration({
                        FunctionName: fn.FunctionName,
                        MemorySize: cliArgs.memory
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
setFunctionMemory();