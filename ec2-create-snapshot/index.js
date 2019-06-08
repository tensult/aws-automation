const AWS = require('aws-sdk');
const EC2 = new AWS.EC2();
const SNS = new AWS.SNS();

function SNSPublish(subject, message, topicARN) {
    let params = {
        Message: message
    };
    if (subject)
        params.Subject = subject;
    if (topicARN)
        params.TopicArn = topicARN;
    return SNS.publish(params).promise();
}

// Check tag key is there or not
function checkTag(tags, tagkey) {
    let hasTag = false;
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].Key === tagkey) {
            hasTag = true;
            break;
        }
    }
    return hasTag;
}

function isSnapshotInstance(ec2Reservations) {
    return checkTag(ec2Reservations.Reservations[0].Instances[0].Tags, 'snapshot');
}

// Create EC2 snapshot based on volume id
function ec2CreateSnapshot(ec2VolumeId) {
    let params = {
        VolumeId: ec2VolumeId,
        Description: 'It is automatically created snapshot and resource volume id: ' + ec2VolumeId,
        TagSpecifications: [
            {
                ResourceType: 'snapshot',
                Tags: [
                    {
                        Key: 'Name',
                        Value: 'Automated'
                    }
                ]
            }

        ]
    };
    return EC2.createSnapshot(params).promise();
}

function ec2StartInstance(ec2InstanceId) {
    let params = {
        InstanceIds: [ec2InstanceId]
    };
    return EC2.startInstances(params).promise();
}

// Stop EC2 instances based on EC2 instance id
function ec2StopInstances(ec2InstanceIds) {
    let params = {
        InstanceIds: ec2InstanceIds
    };
    return EC2.stopInstances(params).promise();
}

// Get EC2 instance ids from Reservations
function getEc2InstanceIds(ec2Reservations) {
    let instanceIds = [];
    ec2Reservations.map((reservation) => {
        reservation.Instances.forEach((instance) => {
            if(instance && instance.InstanceId) {
                instanceIds.push(instance.InstanceId);
            }
        });
    });
    return instanceIds;
}


// Get EC2 instances based on tag key or instance id
function getEc2Instances(tagKey, instanceId, volumeId) {
    let filters = [];
    if (tagKey) {
        filters.push(
            {
                Name: 'tag:' + tagKey,
                Values: ['']
            }
        );
    }
    if (instanceId) {
        filters.push(
            {
                Name: 'instance-id',
                Values: [instanceId]
            }
        );
    }
    if (volumeId) {
        filters.push(
            {
                Name: 'block-device-mapping.volume-id',
                Values: [volumeId]
            }
        );
    }
    return EC2.describeInstances({
        Filters: filters
    }).promise();
}

async function handleStartEc2Instance(ec2Reservations) {
    try {
        if (!isSnapshotInstance(ec2Reservations)) {
            return;
        }
        let instanceId = ec2Reservations.Reservations[0].Instances[0].InstanceId;
        let startedEc2Instances = await ec2StartInstance(instanceId);
        console.log('startedEc2Instances', JSON.stringify(startedEc2Instances));
    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

async function handleSNSPublish(event) {
    try {
        let subject = 'ec2 create snapshot task failure';
        let message = 'volume: ' + event.detail.source + '<br>snapshot id: ' + event.detail['snapshot_id'];
        let publishedSNS = await SNSPublish(subject, message, 'SNS_TOPIC_ARN');
        console.log('publishedSNS', JSON.stringify(publishedSNS));
    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

async function checkRootVolume(ec2Reservations, volumeId) {
    try {
        console.log(JSON.stringify(ec2Reservations));
        if (!ec2Reservations ||
            !ec2Reservations.Reservations ||
            !ec2Reservations.Reservations.length ||
            !ec2Reservations.Reservations[0].Instances ||
            !ec2Reservations.Reservations[0].Instances.length) {
            return false;
        }
        let instance = ec2Reservations.Reservations[0].Instances[0];
        for (let i = 0; i < instance.BlockDeviceMappings.length; i++) {
            if (instance.BlockDeviceMappings[i].DeviceName === instance.RootDeviceName) {
                if (instance.BlockDeviceMappings[i].Ebs.VolumeId === volumeId) {
                    return true;
                }
            }
        }
        return false;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

async function handleEc2CreateSnapshotForOthersVolume(ec2Reservations) {
    try {
        if (!isSnapshotInstance(ec2Reservations)) {
            return;
        }
        let instance = ec2Reservations.Reservations[0].Instances[0];
        let rootDeviceName = instance.RootDeviceName;
        for (let j = 0; j < instance.BlockDeviceMappings.length; j++) { // Create snapshot for other device volume
            if (instance.BlockDeviceMappings[j].DeviceName === rootDeviceName)
                continue;
            let createdEc2Snapshot = await ec2CreateSnapshot(instance.BlockDeviceMappings[j].Ebs.VolumeId);
            console.log('others volume snapshot created:', createdEc2Snapshot);
        }

    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

async function handleEc2CreateSnapshotForRootVolume(instanceId) {
    try {
        let ec2Reservations = await getEc2Instances(undefined, instanceId);
        if (!isSnapshotInstance(ec2Reservations)) {
            return;
        }
        let instance = ec2Reservations.Reservations[0].Instances[0];
        let rootDeviceName = instance.RootDeviceName;
        for (let i = 0; i < instance.BlockDeviceMappings.length; i++) { // Create snapshot for root device volume
            if (instance.BlockDeviceMappings[i].DeviceName === rootDeviceName) {
                let createdEc2Snapshot = await ec2CreateSnapshot(instance.BlockDeviceMappings[i].Ebs.VolumeId);
                console.log('root volume snapshot created:', createdEc2Snapshot);
                break;
            }
        }
    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

async function handleStopEc2Instances() {
    try {
        let ec2Reservations = await getEc2Instances('snapshot');
        let ec2InstanceIds = getEc2InstanceIds(ec2Reservations.Reservations);
        let stoppedEc2Instances = await ec2StopInstances(ec2InstanceIds);
        console.log('stoppedEc2Instances', JSON.stringify(stoppedEc2Instances));
    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

function getVolumeId(volumeSource) {
    // event.detail.source format: arn:aws:ec2::us-west-2:volume/vol-01234567
    return volumeSource.split('/')[1];
}

exports.handler = async (event) => {
    console.log('Received event: ', JSON.stringify(event, null, 2));
    try {
        // Before we take snapshot, we need to stop the instace
        if (event.action === 'stopEc2Instances') {
            await handleStopEc2Instances();
        }
        // When Instance is stopped, we will take root volume snapshot first.
        else if (event['detail-type'] === 'EC2 Instance State-change Notification' && event.detail['instance-id'] && event.detail.state === 'stopped') {
            await handleEc2CreateSnapshotForRootVolume(event.detail['instance-id']);
        }
        // When Root volume snapshot is completed, we will take other volumes snapshots and start the instance
        else if (event['detail-type'] === 'EBS Snapshot Notification' && event.detail.event === 'createSnapshot' && event.detail.result === 'succeeded') {
            let volumeId = getVolumeId(event.detail.source);
            let ec2Reservations = await getEc2Instances(undefined, undefined, volumeId);
            let isRootVolume = await checkRootVolume(ec2Reservations, volumeId);
            if (isRootVolume) {
                await handleEc2CreateSnapshotForOthersVolume(ec2Reservations);
                await handleStartEc2Instance(ec2Reservations);
            }
        }
        // When Root volume snapshot is failed, we will send SNS message for manual investigation and start the instance
        else if (event['detail-type'] === 'EBS Snapshot Notification' && event.detail.event === 'createSnapshot' && event.detail.result === 'failed') {
            await handleSNSPublish(event);
            // event.detail.source format: arn:aws:ec2::us-west-2:volume/vol-01234567
            let volumeId = getVolumeId(event.detail.source);
            let ec2Reservations = await getEc2Instances(undefined, undefined, volumeId);
            let isRootVolume = await checkRootVolume(ec2Reservations, volumeId);
            if (isRootVolume) {
                await handleStartEc2Instance(ec2Reservations);
            }
        }
        return '';
    } catch (err) {
        console.error(err);
        throw err;
    }
};
