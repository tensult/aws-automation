const commonEc2 = require('./common/ec2');
const TAG_KEY = 'autostartstop';
const TAG_VALUE = 'false';

exports.handler = async (event) => {
    try {
        console.log("Received event: ", JSON.stringify(event, null, 2));
        if (!event.action && (event.action !== "start" || event.action !== "stop")) {
            console.log("event.action does not have proper value, should be 'start' and 'stop'");
            return;
        }
        const describeRegionsResponse = await commonEc2.describeRegions();
        const regions = describeRegionsResponse.Regions.map(o => o.RegionName)
        for (const region of regions) {
            if (event.action === 'stop') {
                const filters = [{
                    Name: 'instance-state-name',
                    Values: [
                        'running'
                    ]
                }];
                const describeInstancesByRegionResponse = await commonEc2.describeInstancesByRegion(region, filters);
                const instances = []
                for (const reservation of describeInstancesByRegionResponse.Reservations) {
                    for (const instance of reservation.Instances) {
                        if (instance.Tags.find(o => (o.Key === TAG_KEY && o.Value === TAG_VALUE))) {
                            continue;
                        }
                        instances.push(instance);
                    }
                }
                if (instances.length === 0) {
                    continue;
                }
                const instanceIds = instances.map(o => o.InstanceId);
                await commonEc2.stopInstances(instanceIds);
                console.log('stopped instanceIds\n', instanceIds)
            }
        }
    } catch (err) {
        throw err;
    }
};