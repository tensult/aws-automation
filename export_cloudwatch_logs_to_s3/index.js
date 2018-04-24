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
    if(logGroupName.startsWith('/')) {
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
    return cloudWatchLogs.describeExportTasks(params).promise();
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
        const response = await cloudWatchLogs.createExportTask(params).promise();
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
    return cloudWatchLogs.describeLogGroups(params).promise();
}

// Pass s3BucketName, logFolderName and logGroupFilter in event
exports.handler = async (event) => {
    let s3BucketName = event.s3BucketName;
    let logFolderName = event.logFolderName;
    let nextToken = event.nextToken;
    let logGroupFilter = event.logGroupFilter;
    try {
        let cloudWatchLogGroups = await getCloudWatchLogGroups(nextToken, 1);
        event.nextToken = cloudWatchLogGroups.nextToken;
        event.continue = cloudWatchLogGroups.nextToken !== undefined;
        const logGroupName = cloudWatchLogGroups.logGroups[0].logGroupName;
        if (logGroupFilter && logGroupName.toLowerCase().indexOf(logGroupFilter) < 0) {
            // Ignore log group
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