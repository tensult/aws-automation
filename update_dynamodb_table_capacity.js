const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    tablePrefix: ['t', 'dynamodb table prefix', 'string'],
});

if (!cliArgs.region) {
    cli.getUsage();
}

let isCompleted = false;
let nextToken = undefined;

async function updateTableCapacity(){
    await awsConfigHelper.updateConfig(cliArgs.region);
    const dynamodb= new AWS.DynamoDB()

    while(!isCompleted){
        try {
            const response = await dynamodb.listTables({
                ExclusiveStartTableName: nextToken
            }).promise();
            console.log("Respone: ",response);

            if (response.TableNames) {
                for (i = 0; i < response.TableNames.length; i++) {
                    const tableName = response.TableNames[i];
                    if (cliArgs.tablePrefix && tableName.startsWith(cliArgs.tablePrefix)) {
                        console.log("Table names :",tableName);
                        await dynamodb.updateTable({
                            TableName: tableName,
                            BillingMode: "PAY_PER_REQUEST"
                        }).promise();
                    } else{
                        console.log("Skipping table", tableName);
                        continue;
                    }
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

updateTableCapacity();