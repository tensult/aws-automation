const AWS = require('aws-sdk');
const dynamoDbDocumentClient = new AWS.DynamoDB.DocumentClient()
const dynamoDbConverter = AWS.DynamoDB.Converter

const DESTINATION_TABLE_NAME = process.env.DESTINATION_TABLE_NAME;

function storeItems(items) {
    const params = {
        RequestItems: {
            [DESTINATION_TABLE_NAME]: items
        }
    };
    return dynamoDbDocumentClient.batchWrite(params).promise();
}

async function handleStoringItems(items) {
    try {
        const putRequestItems = []
        for (const item of items) {
            putRequestItems.push({
                PutRequest: {
                    Item: item
                }
            })
        }
        await storeItems(putRequestItems);
    } catch (error) {
        throw error
    }
}

function convertDynamodbData(item) {
    return dynamoDbConverter.unmarshall(item);
}

exports.handler = async (event) => {
    console.log(JSON.stringify(event, null, 2))
    try {
        const items = [];
        for (const record of event.Records) {
            const convertedJson = convertDynamodbData(record.dynamodb.NewImage);
            items.push(convertedJson)
        }
        await handleStoringItems(items);
    } catch (error) {
        console.log(error)
    }
};
