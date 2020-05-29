let elbv2 = null;
let errors = null;

function addTags(resourceArns, tags) {
    const params = {
        ResourceArns: resourceArns,
        Tags: tags
    };
    return elbv2.addTags(params).promise();
}

function describeLbs(lbArn) {
    const params = {
        LoadBalancerArns: [
            lbArn
        ]
    };
    return elbv2.describeLoadBalancers(params).promise();
}

async function filterCorrectElbResources(elbResources) {
    errors = [];
    const _elbResources = elbResources;
    for (const elbResource of _elbResources) {
        try {
            await describeLbs(elbResource);
        } catch (error) {
            errors.push({
                resource: elbResource,
                errorMessage: JSON.stringify(error.message)
            });
            // Remove element from array
            _elbResources.splice(_elbResources.indexOf(elbResource), 1);
        }
    }
    return _elbResources;
}
// filterCorrectElbResources(['afdf.elb.adfafd']).then(res => {
//     console.log(res);
//     console.log(errors)
// })

function filterElbResources(resources) {
    return resources.filter(resource => resource.includes('elasticloadbalancing'));
}
// console.log(filterElbResources(['adfdf.elb.', 'asdasd']))

async function addTagsToElbResources(awsObject, resources, tags) {
    try {
        const AWS = awsObject;
        elbv2 = new AWS.ELBv2();
        const elbResources = filterElbResources(resources);
        const correctElbResources = await filterCorrectElbResources(elbResources);
        if (correctElbResources && correctElbResources.length > 0) {
            await addTags(correctElbResources, tags);
            console.log('Tags added successfully for LB resources are\n',
                JSON.stringify(correctElbResources, null, 2));
        }
        if (errors && errors.length > 0) {
            console.log('Problem with LB resources are\n', JSON.stringify(errors, null, 2));
        }
    } catch (error) {
        throw error;
    }
}
// addTagsToElbResources(require('aws-sdk'), ['arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188'], [{
//     Key: 'demokey',
//     Value: 'demovalue'
// }]);

module.exports = {
    addTagsToElbResources: addTagsToElbResources
};