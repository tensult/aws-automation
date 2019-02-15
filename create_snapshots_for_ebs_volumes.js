/**
 * Create snapshots for EBS volumes:
 * AWS_PROFILE=<aws-profile> node create_snapshots_for_ebs_volumes.js -r ap-south-1 -f "filter1:value1,value2;filter2=value1" -t "key1=value1;key2=value2"
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const wait = require('./util/wait');
const awsUtil = require('./util/aws');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    filters: ['f', 'EBS Filters: filter1:value1,value2;filter2=value1,value2 (optional)', 'string', ''],
    tags: ['t', 'Tags: key1:value1;key2=value2 (optional)', 'string', '']
});

if (!cliArgs.region) {
    cli.getUsage();
}

async function getEBSVolumes(filters) {
    let volumes = [];
    let nextToken = undefined;
    const ec2 = new AWS.EC2();
    do {
        let response = await ec2.describeVolumes({
            Filters: filters,
            NextToken: nextToken
        }).promise();
        nextToken = response.NextToken;
        if (response.Volumes) {
            volumes = volumes.concat(response.Volumes);
        }
        await wait(500);
    } while (nextToken);
    return volumes;
}

async function createSnapshots(volumes, tags) {
    const ec2 = new AWS.EC2();

    for (let volume of volumes) {
        try {
            const snapShotTags = awsUtil.mergeTags(volume.Tags, tags);
            console.log("Creating snapshot for volume:", volume.VolumeId, "with tags", snapShotTags);
            const response = await ec2.createSnapshot({
                VolumeId: volume.VolumeId,
                TagSpecifications: [{ Tags: snapShotTags, ResourceType: "snapshot" }]
            }).promise();
            console.log("Created snapshot:", response.SnapshotId, "for volume:", volume.VolumeId);
            wait(500);
        } catch (error) {
            console.error("Error occurred while creating snapshot for volume:", volume.VolumeId);
        }
    }
}

async function createSnapshotsForEBSVolumes() {
    await awsConfigHelper.updateConfig(cliArgs.region);

    const filters = awsUtil.parseFiltersNameValuesString(cliArgs.filters);
    const tags = awsUtil.parseTagsKeyValueString(cliArgs.tags);
    try {
        console.log("Filters:", filters, "Tags:", tags);
        const volumes = await getEBSVolumes(filters);
        await createSnapshots(volumes, tags);
    } catch (error) {
        console.error('Failed to create snapshots', error);
    }
}
createSnapshotsForEBSVolumes();