/**
 * 
 * This script starts and stops EC2 instances. 
 */

const AWS = require('aws-sdk');

const TAGS = [{
    key: 'autostartandstop',
    value: 'true'
}];

const EC2_REGIONS = [
    'eu-north-1',
    'ap-south-1',
    'eu-west-3',
    'eu-west-2',
    'eu-west-1',
    'ap-northeast-2',
    'ap-northeast-1',
    'sa-east-1',
    'ca-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'eu-central-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2'
];

// Get instance ids by region, state name, tags
async function getEc2InstanceIds(ec2Obj, stateName, tags) {
    try {
        const filters = [{
            Name: "instance-state-name",
            Values: [
                stateName
            ]
        }];
        for (const tagObj of tags) {
            filters.push({
                Name: `tag:${tagObj.key}`,
                Values: [
                    tagObj.value
                ]
            })
        }
        const ec2Instances = await ec2Obj.describeInstances({
            Filters: filters
        }).promise();
        const instanceIds = [];
        for (const reservation of ec2Instances.Reservations) {
            for (const instance of reservation.Instances) {
                instanceIds.push(instance.InstanceId)
            }
        }
        return instanceIds;
    } catch (e) {
        throw e;
    }
}

function stopRunningEC2Instances(ec2Obj, instanceIds) {
    return ec2Obj.stopInstances({
        InstanceIds: instanceIds
    }).promise();
}

function startStoppedEc2Instances(ec2Obj, instanceIds) {
    return ec2Obj.startInstances({
        InstanceIds: instanceIds
    }).promise();
}

async function handleStoppingEc2Instances() {
    try {
        console.log('Stopping instances task started..')
        for (const region of EC2_REGIONS) {
            const ec2Obj = new AWS.EC2({
                region
            })
            const ec2InstanceIds = await getEc2InstanceIds(ec2Obj, 'running', TAGS);
            console.log(region, ': ', ec2InstanceIds);
            if (!ec2InstanceIds || ec2InstanceIds.length === 0) {
                console.log('No instance for region ', region);
                continue;
            }
            await stopRunningEC2Instances(ec2Obj, ec2InstanceIds);
            console.log('Stopping task completed. Instances: ', ec2InstanceIds, '& Region: ', region);
        }
    } catch (e) {
        throw e;
    }
}

async function handleStartingEc2Instances() {
    try {
        console.log('Starting instances task started..')
        for (const region of EC2_REGIONS) {
            const ec2Obj = new AWS.EC2({
                region
            })
            const ec2InstanceIds = await getEc2InstanceIds(ec2Obj, 'stopped', TAGS);
            console.log(region, ': ', ec2InstanceIds);
            if (!ec2InstanceIds || ec2InstanceIds.length === 0) {
                console.log('No instance for region ', region);
                continue;
            }
            await startStoppedEc2Instances(ec2Obj, ec2InstanceIds);
            console.log('Starting task completed. Instances: ', ec2InstanceIds, ' & Region ', region);
        }
    } catch (e) {
        throw e;
    }
}

exports.handler = async (event) => {
    try {
        console.log("Received event: ", JSON.stringify(event, null, 2));
        if (event.action === 'start') {
            await handleStartingEc2Instances();
        }
        if (event.action === 'stop') {
            await handleStoppingEc2Instances();
        }
        return;
    } catch (e) {
        throw e;
    }
};