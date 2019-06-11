const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');
const FileSystem = require("fs");


const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    file: ['fp', 'file path', 'file' , 'environments.json']
});

// environments.json is an object with key and values. file environments.json should have all environment variables of lambda.

const environments = JSON.parse(FileSystem.readFileSync(cliArgs.file, { encoding: "utf-8" }));


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

                    const newEnvironment = { Variables: environments };
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