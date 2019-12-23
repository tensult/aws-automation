//Script to delete security groups by the name of Launch Wizards

const fs = require('fs');
const AWS = require('aws-sdk');

// To this script
// AWS_PROFILE=<profilename> node delete_launch_sg.js


// Give a region in which you want to delete security groups

const regions=['ap-south-1','us-east-1','us-west-1'];

function describeAllSgs(ec2Obj) {
    var params = {
        Filters: [
          {
            Name: 'group-name',
            Values: [
              'launch*',
              /* more items */
            ]
          }
        ]
      };
      return ec2Obj.describeSecurityGroups(params).promise();
}

function deleteSg(ec2Obj, sgGroupId) {
    var params = {
        GroupId: sgGroupId
       };
       return ec2Obj.deleteSecurityGroup(params).promise();
}


async function handler() {
    try {
        if(regions.length<1) {
            throw new Error('Region not found!');
        }
        for(let region of regions) {
            const ec2Obj=new AWS.EC2({region:region});
            const describeAllSgsResponse = await describeAllSgs(ec2Obj);
            const sgs = describeAllSgsResponse.SecurityGroups;
            for(let sg of sgs) {
                try{
                    console.log('Delete started for '+ sg.GroupId+ ' in '+region);
                    console.log(await deleteSg(ec2Obj,sg.GroupId));
                    console.log('Deleted');
                }catch(e) {
                    console.log('Deletetion failed for '+ e);
                }

            }
        }
    } catch (error) {
        console.log(error);
    }
}
handler();



