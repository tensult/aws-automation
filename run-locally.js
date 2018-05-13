const Cli = require('cli');

const cliArgs = Cli.parse({
    profile: ['p', 'AWS profile name', 'string'],
    region: ['r', 'AWS region name', 'string', 'ap-south-1'],
    functionName: ['f', 'Function name', 'string'],
    input: ['i', 'Input to function', 'string']
})

if(!cliArgs.profile || !cliArgs.input) {
    Cli.getUsage();
}

process.env.AWS_PROFILE = cliArgs.profile;
process.env.AWS_REGION = cliArgs.region;

let event = JSON.parse(cliArgs.input);

require(`./${cliArgs.functionName}/index`).handler(event).then(console.log).catch(console.error);