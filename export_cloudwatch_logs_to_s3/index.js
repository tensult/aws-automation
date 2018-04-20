const AWS = require('aws-sdk');
const cloudWatchLogs = new AWS.CloudWatchLogs({ region: 'ap-south-1' });

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
    const logPathParts = logGroupName.split('/');
    const mainParts = logPathParts[0].split('-');
    let logPath = mainParts.slice(1).join('/');
    if (logPathParts.length > 1) {
        logPath = logPath + '-' + logPathParts.slice(1).join('-');
    }
    return logPath;
}

function describeExportTask(taskId) {
    let params = {
        taskId: taskId
    };
    return cloudWatchLogs.describeExportTasks(params).promise();
}

function waitForExportTaskToComplete(taskId) {
    return new Promise((resolve, reject) => {
        describeExportTask(taskId)
            .then((response) => {
                let task = response.exportTasks[0];
                let taskStatus = task.status.code;
                if (taskStatus === 'RUNNING' || taskStatus.indexOf('PENDING')) {
                    console.log('Task is running for ', task.logGroupName);
                    setTimeout(() => {
                        waitForExportTaskToComplete(taskId).then(resolve).catch(reject);
                    }, 1000);
                }
                else {
                    console.log('Task is completed for ', task.logGroupName);
                    resolve();
                }
            })
            .catch(reject)
    })
}

function exportToS3Task(s3BucketName, logGroupName, logFolderName) {
    const logPathForS3 = getLogPathForS3(logGroupName);
    const yesterdayDate = getYesterdayDate();
    let params = {
        destination: s3BucketName,
        destinationPrefix: `${logPathForS3}/${getDatePath(yesterdayDate)}`,
        from: getDayStartTimestamp(getYesterdayDate()),
        logGroupName: logGroupName,
        to: getDayStartTimestamp()
    };
    return cloudWatchLogs.createExportTask(params).promise()
        .then((response) => {
            return waitForExportTaskToComplete(response.taskId);
        });
}

function getCloudWatchLogGroups(nextToken, limit) {
    let params = {
        nextToken: nextToken,
        limit: limit
    };
    return cloudWatchLogs.describeLogGroups(params).promise();
}

exports.handler = async (event) => {
    let s3BucketName = event.s3BucketName;
    let logFolderName = event.logFolderName;
    try {
        let cloudWatchLogGroups = await getCloudWatchLogGroups(nextToken, 1);
        event.nextToken = cloudWatchLogGroups.nextToken;
        event.continue = cloudWatchLogGroups.nextToken !== undefined;
        const logGroupName = cloudWatchLogGroups.logGroups[0].logGroupName;
        if(logGroupName.toLowerCase().indexOf('prod') < 0) {
            return event;
        }
        await exportToS3Task(s3BucketName, logGroupName, logFolderName);
        console.log("Successfully created export task");
        return event;
    } catch (error) {
        console.error(error);
        throw error;
    }
};