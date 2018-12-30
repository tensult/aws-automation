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
            console.log('s3 bucket is created ' + bucketName);
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

function getDatePath(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth()+1;
    const date = dateObj.getDate();
    return `${year}/${month}/${date}`;
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
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const params = {
            destination: s3BucketName,
            destinationPrefix: `${logFolderName}/${logPathForS3}/${getDatePath(new Date())}`,
            from: yesterday.getTime(),
            logGroupName: logGroupName,
            to: today.getTime()
        };
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
    const region = event.region;
    const s3BucketName = event.s3BucketName;
    const logFolderName = event.logFolderName;
    const nextToken = event.nextToken;
    const logGroupFilter = event.logGroupFilter;
    try {
        setRegion(region);
        setInstance();
        await createS3BucketAndPutPolicy(s3BucketName);
        let cloudWatchLogGroups = await getCloudWatchLogGroups(nextToken, 1);
        event.nextToken = cloudWatchLogGroups.nextToken;
        event.continue = cloudWatchLogGroups.nextToken !== undefined;
        if (cloudWatchLogGroups.logGroups.length < 1) {
            return event;
        }
        const logGroupName = cloudWatchLogGroups.logGroups[0].logGroupName;
        if (logGroupFilter && logGroupName.toLowerCase().indexOf(logGroupFilter) < 0) {
            // Ignore log group
            return event;
        }
        await exportToS3Task(s3BucketName, logGroupName, logFolderName);
        console.log("Successfully created export task for " + logGroupName);
        return event;
    } catch (error) {
        console.error(error);
        throw error;
    }
};