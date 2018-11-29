/**
 * @description: This function starts stopped ec2 instances if the following conditions are true.
 *               Conditions:
 *                  1. Instance has tag key "donotstop" and it's value "false".
 *                  2. Instance has tag key "expirydate" and it's value is greater than current time.
 */

const AWS = require('aws-sdk');
const ec2 = new AWS.EC2({ region: 'ap-south-1' });

function startStoppedEc2Instances(instanceIds, regionName) {
    const ec2 = new AWS.EC2({ region: regionName });
    return ec2.startInstances({
        InstanceIds: instanceIds
    }).promise();
}

// tags format => [{Key: "key", Value: "value"}]
function checkTagsOfInstance(tags) {
    let count = 0;
    if (!tags) {
        return false;
    }
    for (const tag of tags) {
        if (tag.Key.toLowerCase() === "donotstop" && tag.Value.toLowerCase() === "false") {
            count++;
        }
        if (tag.Key.toLowerCase() === "expirydate" && Date.now() < new Date(tag.Value).getTime()) {
            count++;
        }
        if (count === 2) {
            return true;
        }
    }
    return false;
}

function filterStoppedEC2InstanceIds(ec2Reservations) {
    return ec2Reservations.map((reservation) => {
        return reservation.Instances;
    }).reduce((allInstances, instancesInReservation) => {
        if (instancesInReservation) {
            allInstances = allInstances.concat(instancesInReservation);
        }
        return allInstances;
    }, []).filter((instance) => {
        return checkTagsOfInstance(instance.Tags);
    }).map((instance) => {
        return instance.InstanceId;
    })
}

function getEC2Instances(regionName, stateName, tagKey, tagValue) {
    const ec2 = new AWS.EC2({ region: regionName });
    const filters = [];
    if (stateName) {
        filters.push({
            Name: 'instance-state-name',
            Values: [
                stateName
            ]
        });
    }
    if (tagKey && tagValue) {
        filters.push({
            Name: 'tag:' + tagKey,
            Values: [
                tagValue
            ]
        });
    }
    return ec2.describeInstances({
        Filters: filters
    }).promise();
}

function getEC2Regions() {
    return ec2.describeRegions().promise();
}

exports.handler = async (event) => {
    try {
        const ec2Regions = await getEC2Regions();
        console.log("Regions: ", ec2Regions);
        for (const region of ec2Regions.Regions) {
            const ec2Instances = await getEC2Instances(region.RegionName, 'stopped', undefined, undefined);
            console.log("Got stopped instances of region ", region.RegionName, ": ", ec2Instances.Reservations);
            if (!ec2Instances.Reservations || ec2Instances.Reservations.length === 0) {
                continue;
            }
            let filteredStoppedEC2InstanceIds = filterStoppedEC2InstanceIds(ec2Instances.Reservations);
            console.log("filtered stopped ec2 instanceIds: ", filteredStoppedEC2InstanceIds);
            if (filteredStoppedEC2InstanceIds && filteredStoppedEC2InstanceIds.length) {
                let doStartStoppedEc2Instances = await startStoppedEc2Instances(filteredStoppedEC2InstanceIds, region.RegionName);
                console.log(doStartStoppedEc2Instances);
            }
        }
    } catch (error) {
        throw error;
    }
}