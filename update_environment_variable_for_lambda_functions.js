/**
 * We can use this script to set or remove an environment variable for all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    envVarName: ['n', 'Environment variable name', 'string'],
    envVarValue: ['v', 'Environment variable value', 'string']
});

if (!cliArgs.envVarName) {
    cli.getUsage();
}


const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function seFunctionEnvVar() {
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
                    if (cliArgs.filterName && !fn.FunctionName.match(filterRegex)) {
                        continue;
                    }
                    const newEnvironment = fn.Environment && fn.Environment.Variables
                                             ? fn.Environment: {Variables: {}};
                    if(!cliArgs.envVarValue) {
                        if(!newEnvironment.Variables || !newEnvironment.Variables[cliArgs.envVarName]) {
                            continue;
                        } else {
                            delete newEnvironment.Variables[cliArgs.envVarName];
                            console.log(`Removing Environment variable ${cliArgs.envVarName} for function: ${fn.FunctionName}`);
                        }
                    } else {
                        newEnvironment.Variables[cliArgs.envVarName] = cliArgs.envVarValue;
                        console.log(`Setting Environment variable ${cliArgs.envVarName} to ${cliArgs.envVarValue} for function: ${fn.FunctionName}`);
                    }
                    await lambda.updateFunctionConfiguration({
                        FunctionName: fn.FunctionName,
                        Environment: newEnvironment
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
seFunctionEnvVar();