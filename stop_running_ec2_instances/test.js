const Cli = require('cli');
const AWS = require('aws-sdk');

const cliArgs = Cli.parse({
    profile: ['p', 'AWS profile name', 'string']
})

if(!cliArgs.profile) {
    Cli.getUsage();
}

AWS.config.signatureVersion = 'v4';
AWS.config.credentials = new AWS.SharedIniFileCredentials({
    profile: cliArgs.profile
});

require('./index').handler({})