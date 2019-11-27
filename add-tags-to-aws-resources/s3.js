let errors = null;
let s3 = null;

function addTags(bucket, tags) {
    const params = {
        Bucket: bucket,
        Tagging: {
            TagSet: tags
        }
    };
    return s3.putBucketTagging(params).promise();
}

function listAllBuckets() {
    return s3.listBuckets({}).promise();
}

async function filterCorrectS3Resources(s3Buckets) {
    try {
        errors = [];
        const _s3Buckets = s3Buckets;
        const allBuckets = await listAllBuckets();
        return _s3Buckets.filter((bucketOf_s3Buckets) => {
            if (allBuckets.Buckets.findIndex((bucketOfAllBuckets) => bucketOfAllBuckets.Name === bucketOf_s3Buckets) !== -1) {
                return true;
            } else {
                errors.push({
                    bucket: bucketOf_s3Buckets,
                    errorMessage: 'Bucket not found'
                });
                return false;
            }
        });
    } catch (error) {
        throw error;
    }
}

async function addTagsToS3Buckets(awsObject, buckets, tags) {
    try {
        const AWS = awsObject;
        s3 = new AWS.S3();
        const correctS3Buckets = await filterCorrectS3Resources(buckets);
        if (correctS3Buckets && correctS3Buckets.length > 0) {
            for (const bucket of correctS3Buckets) {
                await addTags(bucket, tags);
            }
            console.log('Tags added for S3 buckets are\n', JSON.stringify(correctS3Buckets, null, 2));
        }
        if (errors && errors.length > 0) {
            console.log('Problem with S3 buckets are\n', JSON.stringify(errors, null, 2));
        }
    } catch (error) {
        throw error;
    }
}

module.exports = {
    addTagsToS3Buckets: addTagsToS3Buckets
}