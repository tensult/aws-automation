var AWS = require('aws-sdk');

exports.updateConfig = function (profile, region) {
  AWS.CredentialProviderChain.defaultProviders = [
    function () { return new AWS.EnvironmentCredentials('AWS'); },
    function () { return new AWS.EnvironmentCredentials('AMAZON'); },
    function () { return new AWS.SharedIniFileCredentials({ profile: profile }); },
    function () { return new AWS.EC2MetadataCredentials(); }
  ]

  var chain = new AWS.CredentialProviderChain();

  chain.resolve((err, cred) => {
    AWS.config.credentials = cred;
  });


  AWS.config.update({ region: region });
}