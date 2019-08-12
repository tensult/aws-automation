/**
 * Run the following command to execute this script: 
 * $ AWS_PROFILE=<AWS_PROFILE> REGION=<REGION> LAMBDA_ARN=<LAMBDA_ARN> CLOUDFRONT_DIST_CNAME_PREFIX=<CLOUDFRONT_DIST_CNAME_PREFIX> node index.js
 */

const AWS = require('aws-sdk');

const REGION = process.env.REGION;
const LAMBDA_ARN = process.env.LAMBDA_ARN;
const CLOUDFRONT_DIST_CNAME_PREFIX = process.env.CLOUDFRONT_DIST_CNAME_PREFIX;

if (!REGION || !LAMBDA_ARN || !CLOUDFRONT_DIST_CNAME_PREFIX) {
    throw Error('Pass required values to execute this script');
}

AWS.config.update({
    region: REGION
})
const cloudfront = new AWS.CloudFront();

async function listCloudfrontDists() {
    try {
        let nextMarker = '';
        let dists = [];
        let fetchPending = true;
        while (fetchPending) {
            const params = {
                Marker: nextMarker
            };
            const res = await cloudfront.listDistributions(params).promise();
            nextMarker = res.DistributionList.Marker;
            fetchPending = nextMarker === '' ? undefined : nextMarker;
            dists = dists.concat(res.DistributionList.Items);
        }
        return dists;
    } catch (error) {
        throw error;
    }
}

async function filterCloudfrontDists(dists, prefix) {
    try {
        const filteredDists = [];
        for (const dist of dists) {
            if (dist.Aliases.Items && dist.Aliases.Items.length > 0 && dist.Aliases.Items[0].startsWith(prefix)) {
                filteredDists.push(dist)
            }
        }
        return filteredDists;
    } catch (error) {
        throw error;
    }
}

function getCloudfrontDistConfig(id) {
    const params = {
        Id: id
    };
    return cloudfront.getDistributionConfig(params).promise();
}

function updateCloudfrontDist(id, distConfig) {
    distConfig.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Quantity = 2;
    distConfig.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items = [{
            EventType: 'viewer-request',
            LambdaFunctionARN: LAMBDA_ARN,
            IncludeBody: false
        },
        {
            EventType: 'viewer-response',
            LambdaFunctionARN: LAMBDA_ARN,
            IncludeBody: false
        },
    ];
    if (distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.Forward === 'whitelist') {
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.WhitelistedNames.Items.push('X-Session');
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.WhitelistedNames.Quantity += 1;
    } else if (distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.Forward === 'none') {
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.Forward = 'whitelist';
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.WhitelistedNames.Items = ['X-Session'];
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.WhitelistedNames.Quantity = 1;
    }
    const params = {
        DistributionConfig: distConfig.DistributionConfig,
        Id: id,
        IfMatch: distConfig.ETag
    };
    return cloudfront.updateDistribution(params).promise();
}

async function handler() {
    try {
        const cloudfrontDists = await listCloudfrontDists()
        const filteredCloudfrontDists = await filterCloudfrontDists(cloudfrontDists, CLOUDFRONT_DIST_CNAME_PREFIX);
        for (const dist of filteredCloudfrontDists) {
            if (dist.DefaultCacheBehavior.LambdaFunctionAssociations.Quantity === 0) {
                console.log('updating cloufront dist for ', dist.Aliases.Items[0], ' ', dist.Id);
                const distConfig = await getCloudfrontDistConfig(dist.Id);
                await updateCloudfrontDist(dist.Id, distConfig);
                console.log('updated')
            }
        }
    } catch (error) {
        throw error;
    }
}
handler()
