let ec2 = null;
let errors = null;

function describeSgs(sgIds) {
    const params = {
        GroupIds: sgIds
    };
    return ec2.describeSecurityGroups(params).promise();
}

function describeVolumes(volumeIds) {
    const params = {
        VolumeIds: volumeIds
    };
    return ec2.describeVolumes(params).promise();
}

function describeInstances(instanceIds) {
    // console.log('Describing ', instanceIds);
    const params = {
        InstanceIds: instanceIds
    };
    return ec2.describeInstances(params).promise();
}

async function filterCorrectEc2Resources(ec2Resources) {
    const correctEc2Resources = ec2Resources;
    errors = [];
    for (const id of correctEc2Resources.ec2InstanceIds) {
        try {
            await describeInstances([id]);
        } catch (error) {
            errors.push({
                resource: id,
                errorMessage: JSON.stringify(error.message)
            });
            // Remove element from array
            correctEc2Resources.ec2InstanceIds.splice(correctEc2Resources.ec2InstanceIds.indexOf(id), 1);
        }
    }
    for (const id of correctEc2Resources.volumeIds) {
        try {
            await describeVolumes([id]);
        } catch (error) {
            errors.push({
                resource: id,
                errorMessage: JSON.stringify(error.message)
            });
            // Remove element from array
            correctEc2Resources.volumeIds.splice(correctEc2Resources.volumeIds.indexOf(id), 1);
        }
    }
    for (const id of correctEc2Resources.sgIds) {
        try {
            await describeSgs([id]);
        } catch (error) {
            errors.push({
                resource: id,
                errorMessage: JSON.stringify(error.message)
            });
            // Remove element from array
            correctEc2Resources.sgIds.splice(correctEc2Resources.sgIds.indexOf(id), 1);
        }
    }
    return correctEc2Resources;
}

function filterEc2Resources(resources) {
    const _resources = {};
    _resources.ec2InstanceIds = resources.filter(id => id.startsWith('i-'));
    _resources.volumeIds = resources.filter(id => id.startsWith('vol-'));
    _resources.sgIds = resources.filter(id => id.startsWith('sg-'));
    return _resources;
}

async function addTagsToEc2Resources(awsObject, resources, tags) {
    try {
        const AWS = awsObject;
        ec2 = new AWS.EC2();
        const ec2Resources = filterEc2Resources(resources);
        const correctEc2Resources = await filterCorrectEc2Resources(ec2Resources);
        const allCorrectResourcesInAnArray = correctEc2Resources.ec2InstanceIds
            .concat(correctEc2Resources.volumeIds)
            .concat(correctEc2Resources.sgIds);
        if (allCorrectResourcesInAnArray && allCorrectResourcesInAnArray.length > 0) {
            await ec2.createTags({
                Resources: allCorrectResourcesInAnArray,
                Tags: tags
            }).promise();
            console.log('Tags added successfully for EC2 resources are\n',
                JSON.stringify(allCorrectResourcesInAnArray, null, 2));
        }
        if (errors && errors.length > 0) {
            console.log('Problem with EC2 resources are\n', JSON.stringify(errors, null, 2));
        }
    } catch (error) {
        throw error;
    }
}

module.exports = {
    addTagsToEc2Resources: addTagsToEc2Resources
};