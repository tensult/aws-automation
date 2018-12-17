/**
 * 
 * @description This lambda function starts and stops ec2 instances based on event action.
 */


const AWS = require('aws-sdk');
const ec2 = new AWS.EC2({ region: "ap-south-1" });

function convertToLowerCase(string) {
    return string.toLowerCase();
}

function getEC2Regions() {
    return ec2.describeRegions().promise();
}

function getFilteredEC2InstancesIdByExpiryDateTag(ec2Reservations) {
    return ec2Reservations.map((reservation) => {
        return reservation.Instances;
    }).reduce((allInstances, instancesInReservation) => {
        if (instancesInReservation) {
            allInstances = allInstances.concat(instancesInReservation);
        }
        return allInstances;
    }, []).filter((instance) => {
        return instance.Tags.find((tag) => {
            return convertToLowerCase(tag.Key) === "expirydate" && Date.now() < new Date(tag.Value).getTime();
        });
    }).map((instance) => {
        return instance.InstanceId;
    })
}

/**
 *
 * @param {*} tag format should be "{key: "key", value: "value"}"
 * @description This function returns EC2 instances id filtered by current state and following tags:
 *              Tags: key = "donotstop", value = "false"; 
 *                    key = "expirydate", value = currentDate<expirydate
 */
async function getEC2InstancesId(regionName, stateName, tag) {
    const ec2 = new AWS.EC2({ region: regionName });
    const filters = [];
    if (stateName) {
        filters.push({
            Name: "instance-state-name",
            Values: [
                stateName
            ]
        });
    }
    if (tag) {
        const tagKey = convertToLowerCase(tag.key);
        const tagValue = convertToLowerCase(tag.value);
        if (tagKey === "donotstop") {
            filters.push({
                Name: `tag:${tagKey}`,
                Values: [
                    tagValue
                ]
            });
        }
    }
    const ec2Instances = await ec2.describeInstances({ Filters: filters }).promise();
    if (!ec2Instances.Reservations || ec2Instances.Reservations === 0) {
        return;
    }
    return getFilteredEC2InstancesIdByExpiryDateTag(ec2Instances.Reservations);
}

function stopRunningEC2Instances(instanceIds, regionName) {
    const ec2 = new AWS.EC2({ region: regionName });
    return ec2.stopInstances({
        InstanceIds: instanceIds
    }).promise();
}

function startStoppedEc2Instances(instanceIds, regionName) {
    const ec2 = new AWS.EC2({ region: regionName });
    return ec2.startInstances({
        InstanceIds: instanceIds
    }).promise();
}

function getEC2InstanceState(action) {
    switch (action) {
        case "start":
            return "stopped";
        case "stop":
            return "running";
    }
}

/**
 * 
 * @param {*} event event.action should have value "start" or "stop"
 * @description This function takes EC2 instances which are in "running" and "stopped" state and has following tags
 *              Tags: key = "donotstop", value = "false"; 
 *                    key = "expirydate", value = currentDate<expirydate
 *              Then starts or stops instances based on action in event.    
 */
exports.handler = async (event) => {
    try {
        console.log("Received event: ", JSON.stringify(event, null, 2));
        if (!event.action && (event.action !== "start" || event.action !== "stop")) {
            console.log("event.action does not have proper value");
            return;
        }
        const ec2Regions = await getEC2Regions();
        const tag = { key: "donotstop", value: "false" };
        for (const region of ec2Regions.Regions) {
            const ec2InstancesId = await getEC2InstancesId(region.RegionName, getEC2InstanceState(event.action), tag);
            console.log("ec2InstancesId: ", ec2InstancesId);
            if (!ec2InstancesId || ec2InstancesId.length === 0) {
                continue;
            }
            switch (event.action) {
                case "stop":
                    const stoppedInstances = await stopRunningEC2Instances(ec2InstancesId, region.RegionName);
                    console.log("Stopped instances: ", stoppedInstances);
                    break;
                case "start":
                    const startedInstances = await startStoppedEc2Instances(ec2InstancesId, region.RegionName);
                    console.log("Started instances: ", startedInstances);
                    break;
            }
        }
        return;
    } catch (err) {
        throw err;
    }
};