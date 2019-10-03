/**
 * Gets Lambda functions code size
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
});

if (!cliArgs.region) {
    cli.getUsage();
}

const filterRegex = new RegExp(cliArgs.filterName);

let isCompleted = false;
let nextToken = undefined;

async function getFunctionsSize() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const lambda = new AWS.Lambda();
    const totalSize = 0;
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
                    totalSize += fn.CodeSize;
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
    console.log(totalSize / (1024.0 * 1024.0), "GB");
}
getFunctionsSize();