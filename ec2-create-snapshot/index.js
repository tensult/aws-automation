const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();
const sns = new AWS.SNS();

/*************************************************/

const describeInstances = (filters) => {
    const params = {}
    if (filters && filters.length > 0) {
        params.Filters = filters;
    }
    return ec2.describeInstances(params).promise();
}

const stopInstances = (instanceIds) => {
    const params = {
        InstanceIds: instanceIds
    }
    return ec2.stopInstances(params).promise();
}

const startInstanceByInstanceId = (instanceId) => {
    const params = {
        InstanceIds: [instanceId]
    };
    return ec2.startInstances(params).promise();
}

const createSnapshotByVolumeId = (volumeId) => {
    let params = {
        VolumeId: volumeId,
        Description: 'It is automatically created snapshot and resource volume id: ' + volumeId,
        TagSpecifications: [{
                ResourceType: 'snapshot',
                Tags: [{
                    Key: 'Name',
                    Value: 'Automated'
                }]
            }

        ]
    };
    return ec2.createSnapshot(params).promise();
}

const snsPublish = (subject, message, topicARN) => {
    let params = {
        Message: message
    };
    if (subject)
        params.Subject = subject;
    if (topicARN)
        params.TopicArn = topicARN;
    return sns.publish(params).promise();
}

/*************************************************/

function isSnapshotInstance(ec2Reservations) {
    const tags = ec2Reservations.Reservations[0].Instances[0].Tags;
    let hasTag = false;
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].Key === 'snapshot') {
            hasTag = true;
            break;
        }
    }
    return hasTag;
}

// Get EC2 instance ids from Reservations
function getEc2InstanceIds(ec2Reservations) {
    let instanceIds = [];
    ec2Reservations.map((reservation) => {
        reservation.Instances.map((instance) => {
            instanceIds.push(instance.InstanceId);
        });
    });
    return instanceIds;
}

async function handleSnsPublish(event) {
    try {
        let subject = 'EC2 create snapshot task failure';
        let message = 'Volume: ' + event.detail.source + '<br>snapshot id: ' + event.detail['snapshot_id'];
        let publishedSns = await snsPublish(subject, message, 'SNS_TOPIC_ARN');
        console.log('Published SNS\n', JSON.stringify(publishedSns, null, 2));
    } catch (e) {
        console.error('Error from handleSnsPublish() ', e);
        throw e;
    }
}

function isRootVolume(ec2Reservations, volumeId) {
    try {
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
        const instance = ec2Reservations.Reservations[0].Instances[0];
        const rootDeviceName = instance.RootDeviceName;
        for (let j = 0; j < instance.BlockDeviceMappings.length; j++) { // Create snapshot for other device volume
            if (instance.BlockDeviceMappings[j].DeviceName === rootDeviceName)
                continue;
            await createSnapshotByVolumeId(instance.BlockDeviceMappings[j].Ebs.VolumeId);
            console.log('Created snapshot for other volume\n');
        }
    } catch (e) {
        console.error('Error from handleEc2CreateSnapshotForOthersVolume()\n', e);
        throw e;
    }
}

async function handleEc2CreateSnapshotForRootVolume(instanceId) {
    try {
        const ec2Reservations = await describeInstances([{
            Name: 'instance-id',
            Values: [instanceId]
        }]);
        const instance = ec2Reservations.Reservations[0].Instances[0];
        const rootDeviceName = instance.RootDeviceName;
        const rootDeviceInfo = instance.BlockDeviceMappings.find(o => o.DeviceName === rootDeviceName);
        const volumeId = rootDeviceInfo.Ebs.VolumeId;
        await createSnapshotByVolumeId(volumeId);
        console.log('Created snapshot for root volume');
    } catch (e) {
        console.error('Error from handleEc2CreateSnapshotForRootVolume()\n', e);
        throw e;
    }
}

// Stop instances by tag called `snapshot`
async function handleStopEc2Instances() {
    try {
        const ec2Reservations = await describeInstances([{
            Name: 'tag:' + 'snapshot',
            Values: ['']
        }]);
        const ec2InstanceIds = getEc2InstanceIds(ec2Reservations.Reservations);
        const stoppedEc2InstancesResponse = await stopInstances(ec2InstanceIds);
        console.log('StoppedEc2InstancesResponse\n', JSON.stringify(stoppedEc2InstancesResponse, null, 2));
        return stoppedEc2InstancesResponse.StoppingInstances.map(o => {
            return o.InstanceId;
        });
    } catch (e) {
        console.error('Error from handleStopEc2Instances()\n', e);
        throw e;
    }
}

// event.detail.source format: arn:aws:ec2::us-west-2:volume/vol-01234567
function getVolumeId(volumeSource) {
    // event.detail.source format: arn:aws:ec2::us-west-2:volume/vol-01234567
    return volumeSource.split('/')[1];
}

exports.handler = async (event) => {
    console.log('Received event: ', JSON.stringify(event, null, 2));
    let stoppedInstanceIds;
    try {
        // Before we take snapshot, we need to stop the instance
        if (event.action === 'stopEc2Instances') {
            stoppedInstanceIds = await handleStopEc2Instances();
        }
        // When Instance is stopped, we will take root volume snapshot first.
        else if (event['detail-type'] === 'EC2 Instance State-change Notification' && event.detail['instance-id'] && event.detail.state === 'stopped') {
            await handleEc2CreateSnapshotForRootVolume(event.detail['instance-id']);
        }
        // When Root volume snapshot is completed, we will take other volumes snapshots and start the instance
        else if (event['detail-type'] === 'EBS Snapshot Notification' && event.detail.event === 'createSnapshot' && event.detail.result === 'succeeded') {
            const volumeId = getVolumeId(event.detail.source);
            const ec2Reservations = await describeInstances([{
                Name: 'block-device-mapping.volume-id',
                Values: [volumeId]
            }]);
            if (isRootVolume(ec2Reservations, volumeId)) {
                await handleEc2CreateSnapshotForOthersVolume(ec2Reservations);
                await startInstanceByInstanceId(ec2Reservations.Reservations[0].Instances[0].InstanceId);
            }
        }
        // When Root volume snapshot is failed, we will send SNS message for manual investigation and start the instance
        else if (event['detail-type'] === 'EBS Snapshot Notification' && event.detail.event === 'createSnapshot' && event.detail.result === 'failed') {
            await handleSnsPublish(event);
            const volumeId = getVolumeId(event.detail.source);
            const ec2Reservations = await describeInstances([{
                Name: 'block-device-mapping.volume-id',
                Values: [volumeId]
            }]);
            if (isRootVolume(ec2Reservations, volumeId)) {
                await startInstanceByInstanceId(ec2Reservations.Reservations[0].Instances[0].InstanceId);
            }
        }
        return;
    } catch (e) {
        try {
            if (stoppedInstances) {
                for (let instanceId of stoppedInstances) {
                    await startInstanceByInstanceId(instanceId);
                }
            }
        } catch (e) {
            throw e;
        }
        console.error(e);
        throw e;
    }
};