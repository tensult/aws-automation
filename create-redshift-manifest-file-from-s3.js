// To run this: node create-redshift-manifest-file-from-s3.js <your-s3-bucket-name> <your-s3-data-folder-path> 2019-01-01 2019-04-03 
// More info: https://medium.com/tensult/how-to-migrate-aws-redshift-dc2-to-ds2-node-cluster-73f320dc57f6
const AWS = require("aws-sdk");
const FileSystem = require('node-fs');

const s3 = new AWS.S3();

let s3BucketName = process.argv[2];
let s3FolderPrefix = process.argv[3];
let startDate = process.argv[4]; // Example: 2019-01-01
let endDate = process.argv[5]; // Example: 2019-04-04

function getDatesInBetween(startDate, endDate) {
    let dates = [];
    while (startDate < endDate) {
        for (i = 0; i < 24; i++) {
            startDate.setHours(i);
            dates.push(toDateString(startDate))
        }
        startDate.setDate(startDate.getDate() + 1);
    }
    return dates;
}

function toDateString(date) {
    return date.toISOString().substring(0, 13).replace(/[-T]/g, "/"); // Example: 2019/04/04/01
}

function listDayWiseObjects(dateWithHour) {

    let s3Prefix = `${s3FolderPrefix}/${dateWithHour}`
    console.log(Prefix);
    return s3.listObjectsV2({
        Bucket: s3BucketName,
        Prefix: s3Prefix
    }).promise();
}


async function prepareManifests() {
    const dates = getDatesInBetween(new Date(startDate), new Date(endDate));
    for (i = 0; i < dates.length; i++) {
        const s3Response = await listDayWiseObjects(dates[i]);
        if (s3Response.Contents && s3Response.Contents.length) {
            const manifest = {};
            manifest.entries = s3Response.Contents.map((s3Object) => {
                return {
                    url: `s3://${s3BucketName}/${s3Object.Key}`,
                    mandatory: true
                }
            });
            FileSystem.mkdirSync("migration/" + dates[i], 0777, true);
            FileSystem.writeFileSync("migration/" + dates[i] + '/manifest', JSON.stringify(manifest, null, 2));
        }
    }
}

prepareManifests();
