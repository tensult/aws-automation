const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require("aws-sdk");
const cli = require('cli');


const cliArgs = cli.parse({
    region: ['r', 'AWS region', 'string'],
    listenerArn: ['l', 'Rule Arn', 'string'],
    query: ['q', 'Query', 'string', undefined],
    host: ['h', 'Host Name', 'string'],
    redirectHost: ['d', 'Redirect Host Name', 'string'],
    path: ['p', 'Destination ARN', 'string', '/#{path}'],
    priority: ['o', 'priority', 'number']
});

if (!cliArgs.region || !cliArgs.listenerArn) {
    cli.getUsage();
}


async function updateElbListenerRuleForRedirectUrl() {
    await awsConfigHelper.updateConfig(cliArgs.region);
    const elbV2 = new AWS.ELBv2();

    return await elbV2.createRule({
        Actions: [
            {
                Type: "redirect",
                RedirectConfig: {
                    StatusCode: "HTTP_301",
                    Host: cliArgs.redirectHost,
                    Path: cliArgs.path,
                    Port: '443',
                    Protocol: 'HTTPS',
                    Query: cliArgs.query
                }
            }
        ],
        Conditions: [
            {
                "Field": "host-header",
                "Values": [cliArgs.host]

            }
        ],
        ListenerArn: cliArgs.listenerArn,
        Priority: cliArgs.priority

    }).promise();
}


updateElbListenerRuleForRedirectUrl();

