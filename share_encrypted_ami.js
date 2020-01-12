/**
 * Shares AMI with another AWS account.
 * Supports AMI encrypted with default KMS key
 * Usage: AWS_PROFILE=<your-aws-profile> node share_encrypted_ami.js -r <region> -a <ami-id> -A <accountId-to-share> -k <KMS Customer managed key>
 */
const awsConfigHelper = require('./util/awsConfigHelper');
const AWS = require('aws-sdk');
const cli = require('cli');
const commonUtils = require('./util/common');
const waitUtils = require('./util/wait');

const cliArgs = cli.parse({
    region: ['r', 'Source AWS region', 'string'],
    dest_region: ['R', 'Destination AWS region', 'string'],
    ami: ['a', "AMI ID", "string"],
    account_to_share: ['A', "Target AWS account ID", "string"],
    kms_key: ['k', "KMS KeyId to be used to encrypt", "string"],
});

if (!cliArgs.region || !cliArgs.ami || !cliArgs.account_to_share) {
    cli.getUsage();
}

if (!cliArgs.dest_region) {
    cliArgs.dest_region = cliArgs.region;
}

async function fetchKMSKey(kms, key) {
    const keyDetails = await kms.describeKey({ KeyId: key }).promise();
    return keyDetails.KeyMetadata;
}

async function fetchKMSKeys(kms, keys) {
    const kmsKeysDetails = [];
    for (let key of keys) {
        kmsKeysDetails.push(await fetchKMSKey(kms, key));
    }
    return kmsKeysDetails;
}

function isDefaultKmsKey(kmsKey) {
    return kmsKey.KeyManager === "AWS";
}
function getAWSDefaultKeys(kmsKeysDetails) {
    const kmsKeysDetailsArray = commonUtils.toArray(kmsKeysDetails);
    return kmsKeysDetailsArray.filter((kmsKey) => {
        return isDefaultKmsKey(kmsKey);
    });
}

async function getImageDetails(ec2, amiId) {
    const amisDetails = await ec2.describeImages({
        ImageIds: commonUtils.toArray(amiId)
    }).promise();
    if (!amisDetails.Images || !amisDetails.Images.length) {
        return console.error("Provided AMI Id doesn't exist");
    }
    return amisDetails.Images[0];
}
async function getKmsKeysUsed(ec2, ami) {
    const snapshotIDs = new Set();
    ami.BlockDeviceMappings.forEach((volume) => {
        if (volume.Ebs.SnapshotId) {
            snapshotIDs.add(volume.Ebs.SnapshotId);
        }
    });

    const snapshotDetails = await ec2.describeSnapshots({
        SnapshotIds: Array.from(snapshotIDs)
    }).promise();
    return snapshotDetails.Snapshots.filter((snapshot) => snapshot.KmsKeyId)
        .map((snapshot) => snapshot.KmsKeyId);
}

async function copyAMI(ec2, ami, kmsKey) {
    const response = await ec2.copyImage({
        Encrypted: !!kmsKey,
        KmsKeyId: kmsKey,
        SourceImageId: ami.ImageId,
        SourceRegion: cliArgs.region,
        Name: ami.Name + "_" + Date.now()
    }).promise();
    return response.ImageId;
}

async function handleDefaultKmsKeys(kms) {
    console.log("AMI is encrypted with default KMS keys");
    if (!cliArgs.kms_key) {
        console.error(`AMI is encrypted with default key so please provide Customer Manager Key (CMK)`);
        process.exit(-1);
    } else {
        const userKmsKey = await fetchKMSKey(kms, cliArgs.kms_key);
        if (isDefaultKmsKey(userKmsKey)) {
            console.error(`${cliArgs.kms_key} is AWS default key, please provide customer managed key`);
            process.exit(-1);
        }
        if (!userKmsKey.Arn.includes(cliArgs.dest_region)) {
            console.error(`${cliArgs.kms_key} should be from the destination region`);
            process.exit(-1);
        }
    }
}

async function shareAmiWithDifferentAccount(ec2, ami, accountId) {
    let imageDetails = {};
    do {
        imageDetails = await getImageDetails(ec2, ami);
        console.log(`ami=${imageDetails.ImageId} is in state=${imageDetails.State}`);
        if (imageDetails.State === 'pending') {
            console.log("so waiting");
            await waitUtils(5000);
        }
    } while (imageDetails.State === 'pending');

    if (imageDetails.State !== "available") {
        console.error(`ami=${imageDetails.ImageId} is in state=${imageDetails.State} so can't be shared`);
        process.exit(-1);
    }
    console.log(`ami=${imageDetails.ImageId} will be shared with ${accountId}`);
    return await ec2.modifyImageAttribute({
        ImageId: ami,
        LaunchPermission: {
            Add: [
                {
                    UserId: accountId.toString()
                }
            ]
        }
    }).promise();
}

async function shareAMI() {
    try {
        await awsConfigHelper.updateConfig(cliArgs.region);
        const ec2_source_region = new AWS.EC2();
        const ec2_destination_region = new AWS.EC2({ region: cliArgs.dest_region });
        const kms = new AWS.KMS();
        const amiInfo = await getImageDetails(ec2_source_region, cliArgs.ami);
        const kmsKeysUsed = await getKmsKeysUsed(ec2_source_region, amiInfo);
        const kmsKeysDetails = await fetchKMSKeys(kms, kmsKeysUsed);
        const defaultKMSKeys = getAWSDefaultKeys(kmsKeysDetails);
        let newAMIId = cliArgs.ami;
        let shouldCopyAmi = defaultKMSKeys.length > 0 || cliArgs.region !== cliArgs.dest_region;
        if (defaultKMSKeys.length > 0) {
            handleDefaultKmsKeys(kms);
        }
        if (shouldCopyAmi) {
            console.log("AMI will be copied to a new AMI");
            newAMIId = await copyAMI(ec2_destination_region, amiInfo, cliArgs.kms_key);
        }
        await shareAmiWithDifferentAccount(ec2_destination_region, newAMIId, cliArgs.account_to_share);
    } catch (error) {
        throw error;
    };
}

shareAMI();