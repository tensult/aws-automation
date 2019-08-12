/**
 * Steps to execute:
 * 1. Set AWS profile in your cli environment for which account you want to run
 * 2. Run the following commands: 
 *    $ npm i aws-sdk cli
 *    $ node update_cloudfront_distributions_to_add_lambda_at_edge.js -r <region> -l <lambda_arn> -p <cloudfront_dist_cname_prefix>
 */

const AWS = require('aws-sdk');
const Cli = require('cli');

const cliArgs = Cli.parse({
    region: ['r', 'AWS region name', 'string', 'ap-south-1'],
    lambdaArn: ['l', 'Lambda ARN', 'string'],
    cloudfrontDistCnamePrefix: ['p', 'cloudfront dist cname prefix', 'string']
})

if (!cliArgs.region || !cliArgs.lambdaArn || !cliArgs.cloudfrontDistCnamePrefix) {
    console.log(cliArgs)
    Cli.getUsage();
}

const REGION = cliArgs.region;
const LAMBDA_ARN = cliArgs.lambdaArn;
const CLOUDFRONT_DIST_CNAME_PREFIX = cliArgs.cloudfrontDistCnamePrefix;

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
        distConfig.DistributionConfig.DefaultCacheBehavior.ForwardedValues.Cookies.WhitelistedNames = {
            Items: ['X-Session'],
            Quantity: 1
        };
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