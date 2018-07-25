/**
 * We can use this script to get a particular environment variable of all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    envVarName: ['n', 'Environment variable name', 'string']
});

if (!cliArgs.profile || !cliArgs.region || !cliArgs.envVarName) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const lambda = new AWS.Lambda();
const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function getEnvironmentVariable() {
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
                   
                    if(fn.Environment && fn.Environment.Variables && fn.Environment.Variables[cliArgs.envVarName]) {
                        console.log(`${fn.FunctionName} has Environment variable: ${cliArgs.envVarName} with value: ${fn.Environment.Variables[cliArgs.envVarName]}`);
                    } else {
                        console.log(`${fn.FunctionName} has not Environment variable: ${cliArgs.envVarName}`);
                    }
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
getEnvironmentVariable();