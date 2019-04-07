// To run this: node redshift-bulk-copy-from-s3.js <s3-bucket-name> <s3-manifest-folder-path> <redshift-EndPoint> <redshift-DBName> <redshift-DBUser> <redshift-DBPassword> <redshift-DBTableName> <redshift-S3Role> 
const pg = require("pg");
const AWS = require("aws-sdk");
const s3 = new AWS.S3();

let s3BucketName = process.argv[2];
let s3FolderPrefix = process.argv[3];
let redShiftEndPoint = process.argv[4];
let redShiftDBName = process.argv[5];
let redShiftDBUser = process.argv[6];
let redShiftDBPassword = process.argv[7];
let redShiftDBTableName = process.argv[8];
let redShiftS3Role = process.argv[9]; // S3 bucket Read permissions should be granted to RedShift 

const pool = new pg.Pool({
    host: redShiftEndPoint,
    database: redShiftDBName,
    password: redShiftDBPassword,
    port: 8192,
    user: redShiftDBUser,
});

const connectionPromise = pool.connect();
async function executeQuery(query, params) {
    await connectionPromise;
    const result = await pool.query(query, params)
    console.log(result);
}

function listDayWiseObjects() {
    return s3.listObjectsV2({
        Bucket: s3BucketName,
        Prefix: s3FolderPrefix
    }).promise();
}

async function migrateToRedShift() {
    const s3Response = await listDayWiseObjects();
    if (s3Response.Contents && s3Response.Contents.length) {
        for (let s3Object of s3Response.Contents) {
            if (!s3Object.Key.endsWith("manifest")) {
                console.log("Skipping", s3Object.Key);
                continue;
            }
            console.log("Processing", s3Object.Key);
            await executeQuery(`COPY ${redShiftDBTableName} FROM 's3://${s3BucketName}/${s3Object.Key}' CREDENTIALS 'aws_iam_role=${redShiftS3Role}' MANIFEST TRUNCATECOLUMNS TIMEFORMAT 'epochmillisecs'`);
        }
    }
    console.log("Migration finished");
}

migrateToRedShift();
