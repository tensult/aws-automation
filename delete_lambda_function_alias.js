/**
 * Deletes lambda function alias. 
 *
 * We can use this script to delete an alias of all our Lambda functions at once.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filterName: ['f', 'Pass filter name to filter Lambda functions', 'string'],
    aliasName: ['a', 'Alias name to be deleted', 'string']
});

if (!cliArgs.region || !cliArgs.aliasName) {
    cli.getUsage();
}

const filterRegex = new RegExp(cliArgs.filterName);

async function deleteFunctionAlias() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const lambda = new AWS.Lambda();

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
                    try {
                        await lambda.deleteAlias({
                            FunctionName: fn.FunctionName,
                            Name: cliArgs.aliasName
                        }).promise();
                        console.log(`Deleted alias: ${cliArgs.aliasName} for function: ${fn.FunctionName}`);
                    } catch (error) {
                        console.log(`No alias: ${cliArgs.aliasName} for function: ${fn.FunctionName}`);
                    }
                    await wait(1000);

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
deleteFunctionAlias();