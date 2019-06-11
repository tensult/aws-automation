const AWS = require('aws-sdk')
// AWS.config.update({
//     region: 'ap-south-1'
// })
const rds = new AWS.RDS();

async function getAllDbInstances() {
    try {
        let dbInstances = [];
        let fetchPending = true;
        let marker;
        while (fetchPending) {
            const params = {
                Marker: marker,
            };
            const response = await rds.describeDBInstances(params).promise();
            dbInstances = dbInstances.concat(response.DBInstances);
            marker = response.Marker | undefined;
            fetchPending = marker;
        }
        return dbInstances;
    } catch (error) {
        throw error;
    }
}

async function getAllTagsOfRdsResource(resourceName) {
    try {
        const params = {
            ResourceName: resourceName,
        };
        const response = await rds.listTagsForResource(params).promise();
        return response.TagList;
    } catch (error) {
        throw error
    }
}

function stopRdsInstance(instanceIdentifier) {
    const params = {
        DBInstanceIdentifier: instanceIdentifier
    };
    return rds.stopDBInstance(params).promise();
}

async function stopRdsInstancesByTag() {
    try {
        const dbInstances = await getAllDbInstances()
        for (const instance of dbInstances) {
            const tags = await getAllTagsOfRdsResource(instance.DBInstanceArn)
            if (tags.find(o => o.Key.toLowerCase() === 'donotstop')) {
                console.log('stoppable arn ', instance.DBInstanceArn);
                const response = await stopRdsInstance(instance.DBInstanceIdentifier);
                console.log('Stopped instance ', JSON.stringify(response, null, 2));
            }
        }
    } catch (error) {
        throw error
    }
}

exports.handler = async (event) => {
    try {
        await stopRdsInstancesByTag();
    } catch (error) {
        console.error(error);
    }
}