/**
 * We can use this script to send SES verification email.
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require('aws-sdk');
const cli = require('cli');

const cliArgs = cli.parse({
    profile: ['p', 'AWS profile name', 'string', 'default'],
    region: ['r', 'AWS region', 'string'],
    email: ['e', "Email to be verified by SES", "string"],
});

if (!cliArgs.profile || !cliArgs.region || !cliArgs.email) {
    cli.getUsage();
}

async function sendVerificationEmail() {

    try {
        await awsConfigHelper.updateConfig(cliArgs.profile, cliArgs.region);
        const ses = new AWS.SES();
        return await ses.verifyEmailIdentity({
            EmailAddress: cliArgs.email
        }).promise();
    } catch (error) {
        throw error;
    };
}

sendVerificationEmail();