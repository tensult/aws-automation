const AWS = require('aws-sdk');
let cloudwatchLogsInstance = {};
let s3Instance = {};
let __region = '';

function setRegion(_region) {
    __region = _region;
}

function setInstance(_region) {
    cloudwatchLogsInstance = new AWS.CloudWatchLogs({ region: __region });
    s3Instance = new AWS.S3({ region: __region });
}

function getS3Buckets() {
    return s3Instance.listBuckets({}).promise();
}

async function isS3BucketExists(bucketName) {
    try {
        let bucketsObject = await getS3Buckets();
        let isBucketExists = bucketsObject.Buckets.find((bucket) => {
            return bucket.Name === bucketName;
        })
        // console.log(isBucketExists);
        if (isBucketExists)
            return true;
        else
            return false;
    } catch (err) {
        console.error(err);
    }
}

async function createS3BucketAndPutPolicy(bucketName) {
    try {
        let _isS3BucketExist = await isS3BucketExists(bucketName);
        if (_isS3BucketExist) {
            console.log('s3 bucket exists');
        }
        else {
            await s3Instance.createBucket({
                Bucket: bucketName
            }).promise();
            console.log('s3 bucket is created '+ bucketName);
            // await putS3BucketPolicy(bucketName);
            await s3Instance.putBucketPolicy({
                Bucket: bucketName,
                Policy: "{\"Version\": \"2012-10-17\",\"Statement\": [{\"Effect\": \"Allow\",\
                            \"Principal\": {\
                                \"Service\": \"logs."+ __region + ".amazonaws.com\"\
                            },\
                            \"Action\": \"s3:GetBucketAcl\",\
                            \"Resource\": \"arn:aws:s3:::"+ bucketName + "\"\
                        },\
                        {\
                            \"Effect\": \"Allow\",\
                            \"Principal\": {\
                                \"Service\": \"logs."+ __region + ".amazonaws.com\"\
                            },\
                            \"Action\": \"s3:PutObject\",\
                            \"Resource\": \"arn:aws:s3:::"+ bucketName + "/*\",\
                            \"Condition\": {\
                                \"StringEquals\": {\
                                    \"s3:x-amz-acl\": \"bucket-owner-full-control\"\
                                }\
                            }\
                        }\
                    ]\
                }"
            }).promise();
            console.log('s3 bucket policy is added');
        }
    } catch (err) {
        console.error(err);
    }
}


function getDayStartTimestamp(date) {
    date = date || new Date();
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
    return date.getTime();
}

function getYesterdayDate() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return date;
}

function getDatePath(date) {
    date = date || new Date();
    const dateString = date.toISOString().substring(0, 10);
    return dateString.replace(/-/g, '/');
}

function getLogPathForS3(logGroupName) {
    if (logGroupName.startsWith('/')) {
        logGroupName = logGroupName.slice(1);
    }
    return logGroupName.replace(/\//g, '-');
}

function wait(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, timeout)
    })
}

function describeExportTask(taskId) {
    let params = {
        taskId: taskId
    };
    return cloudwatchLogsInstance.describeExportTasks(params).promise();
}

let waitErrorCount = 0;
async function waitForExportTaskToComplete(taskId) {
    try {
        const taskDetails = await describeExportTask(taskId);
        let task = taskDetails.exportTasks[0];
        let taskStatus = task.status.code;
        if (taskStatus === 'RUNNING' || taskStatus.indexOf('PENDING') !== -1) {
            console.log('Task is running for ', task.logGroupName, 'with stats', task.status);
            await wait(1000);
            return await waitForExportTaskToComplete(taskId);
        }
        return true;
    } catch (error) {
        waitErrorCount++;
        if (waitErrorCount < 3) {
            return await waitForExportTaskToComplete(taskId);
        }
        throw error;
    }
}

async function exportToS3Task(s3BucketName, logGroupName, logFolderName) {
    try {
        const logPathForS3 = getLogPathForS3(logGroupName);
        const yesterdayDate = getYesterdayDate();
        let params = {
            destination: s3BucketName,
            destinationPrefix: `${logFolderName}/${logPathForS3}/${getDatePath(yesterdayDate)}`,
            from: getDayStartTimestamp(getYesterdayDate()),
            logGroupName: logGroupName,
            to: getDayStartTimestamp()
        };
        // console.log(params);
        const response = await cloudwatchLogsInstance.createExportTask(params).promise();
        await waitForExportTaskToComplete(response.taskId);
    } catch (error) {
        throw error;
    }
}

function getCloudWatchLogGroups(nextToken, limit) {
    let params = {
        nextToken: nextToken,
        limit: limit
    };
    return cloudwatchLogsInstance.describeLogGroups(params).promise();
}

exports.handler = async (event) => {
    let region = event.region;
    let s3BucketName = event.s3BucketName;
    let logFolderName = event.logFolderName;
    let nextToken = event.nextToken;
    let logGroupFilter = event.logGroupFilter;
    try {
        setRegion(region);
        setInstance();
        await createS3BucketAndPutPolicy(s3BucketName);
        let cloudWatchLogGroups = await getCloudWatchLogGroups(nextToken, 1);
        event.nextToken = cloudWatchLogGroups.nextToken;
        event.continue = cloudWatchLogGroups.nextToken !== undefined;
        const logGroupName = cloudWatchLogGroups.logGroups[0].logGroupName;
        if (logGroupFilter && logGroupName.toLowerCase().indexOf(logGroupFilter) < 0) {
            // Ignore log group
            return event;
        }
        await exportToS3Task(s3BucketName, logGroupName, logFolderName);
        console.log("Successfully created export task for "+ logGroupName);
        return event;
    } catch (error) {
        console.error(error);
        throw error;
    }
};