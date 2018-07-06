/**
 * DynamoDB table backups provides disaster recovery for tables in case of accidental deletes
 * so it is recommended to enable table backups for production tables.
 * To know more, you can read this blog: 
 * https://medium.com/tensult/aws-dynamodb-point-in-time-recovery-e8711d6d04cb
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    tablePrefix: ['t', 'dynamodb table prefix', 'string'],
});

if(!cliArgs.profile || !cliArgs.region) {
    cli.getUsage();
}

awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);

const dynamodb = new AWS.DynamoDB();

let isCompleted = false;
let nextToken = undefined;

async function enableTableBackup() {
    while (!isCompleted) {
        try {
            const response = await dynamodb.listTables({
                ExclusiveStartTableName: nextToken
            }).promise();
            if (response.TableNames) {
                for (i = 0; i < response.TableNames.length; i++) {
                    const tableName = response.TableNames[i];
                    if(cliArgs.tablePrefix && !tableName.startsWith(cliArgs.tablePrefix)) {
                        console.log("Skipping table", tableName);
                        continue;
                    }
                    const tableBackup = await dynamodb.describeContinuousBackups({
                        TableName: tableName
                    }).promise().then((tableResponse) => {
                        return tableResponse.ContinuousBackupsDescription;
                    });
                    if (tableBackup.ContinuousBackupsStatus === 'ENABLED') {
                        console.log("Skipping table", tableName, "as backup is already enabled");
                        continue;
                    }
                    console.log("Enabling continuous backup for", tableName);
                    await dynamodb.updateContinuousBackups({
                        TableName: tableName,
                        PointInTimeRecoverySpecification: {
                            PointInTimeRecoveryEnabled: true
                        }
                    }).promise();
                    await wait(500);
                }
                nextToken = response.LastEvaluatedTableName;
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
enableTableBackup();