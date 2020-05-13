'use strict'

// AWS_PROFILE=<AWS_PROFILE> AWS_REGION=<AWS_REGION> TABLE_NAME=<TABLE_NAME> HASH_KEY=<HASH_KEY> TIMESTAMP_ATTRIBUTE_NAME=<TIMESTAMP_ATTRIBUTE_NAME>  node update-all-items.js

const AWS = require('aws-sdk');
const dynamodbDocumentClient = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const HASH_KEY = process.env.HASH_KEY;
const RANGE_KEY = process.env.RANGE_KEY;
const TIMESTAMP_ATTRIBUTE_NAME = process.env.TIMESTAMP_ATTRIBUTE_NAME;

function validateEnvData(...data) {
  for (const e of data) {
    if (!e) {
      throw new Error('Pass required fileds TABLE_NAME, HASH_KEY, TIMESTAMP_ATTRIBUTE_NAME');
    }
  }
}

function getAllItems(tableName) {
  const params = {
    TableName: tableName,
  };
  return dynamodbDocumentClient.scan(params).promise();
};

function updateItem(tableName, key, timestampAttributeName) {
  console.log(key)
  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: "set #a = :x",
    ExpressionAttributeNames: { "#a": timestampAttributeName },
    ExpressionAttributeValues: {
      ":x": Date.now(),
    },
  };
  return dynamodbDocumentClient.update(params).promise();
};

function makeKeyObj(item, ...keys) {
  const key = {};
  for (const _key of keys) {
    if (_key) {
      key[_key] = item[_key];
    }
  }
  return key;
}

async function updateAllItemsHandler() {
  let count = 0;
  try {
    validateEnvData(TABLE_NAME, HASH_KEY, TIMESTAMP_ATTRIBUTE_NAME);
    const items = await getAllItems(TABLE_NAME);
    console.log('Got all items');
    for (const item of items.Items) {
      if (!item[TIMESTAMP_ATTRIBUTE_NAME]) {
        console.log('TIMESTAMP_ATTRIBUTE_NAME=' + TIMESTAMP_ATTRIBUTE_NAME + 'is not found for ', item);
        continue;
      }
      await updateItem(TABLE_NAME, makeKeyObj(item, HASH_KEY, RANGE_KEY), TIMESTAMP_ATTRIBUTE_NAME);
      count++;
    }
  } catch (error) {
    throw error;
  } finally {
    console.log('Total count of updated items is ' + count);
  }
};


updateAllItemsHandler();
