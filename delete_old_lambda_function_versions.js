/**
 * Deletes lambda function versions. 
 *
 * We can use this script to delete old versions of all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    maxVersions: ['v', 'Maximum versions to keep: should be greater than 0', 'number', 3]
});

if (!cliArgs.profile || !cliArgs.region || cliArgs.maxVersions < 1) {
    cli.getUsage();
}

let lambda;
const filterRegex = new RegExp(cliArgs.filterName);

async function getFunctionVersions(functionName) {
    let functionVersions = [];
    let isCompleted = false;
    let marker = undefined;
    while (!isCompleted) {
        let response = await lambda.listVersionsByFunction({
            FunctionName: functionName,
            Marker: marker
        }).promise();
        marker = response.NextMarker;
        if (response.Versions) {
            functionVersions = functionVersions.concat(response.Versions);
            isCompleted = marker === undefined || marker === null;
        } else {
            isCompleted = true;
        }
        await wait(500);
    }
    return functionVersions.sort((v1, v2) => {
        if (v1.LastModified < v2.LastModified) {
            return 1;
        } else if (v1.LastModified === v2.LastModified) {
            return 0
        } else {
            return -1
        }
    });
}

async function deleteFunctionVersions() {
    await awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);
    lambda = new AWS.Lambda();
    let isCompleted = false;
    let nextToken = undefined;
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

                    const functionVersions = await getFunctionVersions(fn.FunctionName);
                    if (functionVersions.length <= cliArgs.maxVersions) {
                        continue;
                    }

                    for (let i = cliArgs.maxVersions; i < functionVersions.length; i++) {
                        console.log(`Deleting version: ${functionVersions[i].Version} for function: ${functionVersions[i].FunctionName}`);
                        await lambda.deleteFunction({
                            FunctionName: functionVersions[i].FunctionName,
                            Qualifier: functionVersions[i].Version
                        }).promise();
                        await wait(1000);
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
deleteFunctionVersions();