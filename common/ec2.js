const AWS = require('aws-sdk')
// AWS.config.update({
//     region: 'ap-south-1'
// })
const ec2 = new AWS.EC2();

const describeInstances = (filters) => {
    const params = {}
    if (filters && filters.length > 0) {
        params.Filters = filters;
    }
    return ec2.describeInstances(params).promise();
}

const describeInstancesByRegion = (region, filters) => {
    const ec2 = new AWS.EC2({
        region
    })
    const params = {};
    if (filters && filters.length > 0) {
        params.Filters = filters;
    }
    return ec2.describeInstances(params).promise();
}

const describeRegions = () => {
    const params = {};
    return ec2.describeRegions(params).promise();
}
// describeRegions().then((res) => console.log(res))

const stopInstances = (instanceIds) => {
    const params = {
        InstanceIds: instanceIds
    }
    return ec2.stopInstances(params).promise();
}

exports.describeInstances = describeInstances;
exports.describeRegions = describeRegions;
exports.describeInstancesByRegion = describeInstancesByRegion;
exports.stopInstances = stopInstances;