const AWS = require('aws-sdk');
const EC2 = new AWS.EC2({
    region: 'ap-south-1'
});
const tag = 'snapshot';

function ec2CreateSnapshot(ec2VolumeId) {
    let params = {
        VolumeId: ec2VolumeId,
        Description: 'volume id: '+ ec2VolumeId
    };
    return EC2.createSnapshot(params).promise();
}

function getEc2Volume(ec2InstanceId) {
    let params = {
        Filters: [
            {
                Name: 'attachment.instance-id',
                Values: [ec2InstanceId]
            }
        ]
    }
    return EC2.describeVolumes(params).promise();
}

function getEc2Instances() {
    let params = {
        Filters: [
            {
                Name: 'tag:' + tag,
                Values: ['']
            }
        ]
    }
    return EC2.describeInstances(params).promise();
}

exports.handler = async () => {
    let ec2Instances = await getEc2Instances();
    for (let i = 0; i < ec2Instances.Reservations.length; i++) {
        for (let j = 0; j < ec2Instances.Reservations[i].Instances.length; j++) {
            let ec2Volumes = await getEc2Volume(ec2Instances.Reservations[i].Instances[j].InstanceId);
            for(let k=0; k<ec2Volumes.Volumes.length; k++) {
                let snapshotCreated = await ec2CreateSnapshot(ec2Volumes.Volumes[k].VolumeId);
                console.log(snapshotCreated);
            }
        }
    }
    return '';
}