
# AWS Automation with Lambda
- [Set cloudwatch log group retention](#set-cloudwatch-log-group-retention)
- [Exports cloudwatch logs to s3](#export-cloudwatch-logs-to-s3)
# Set cloudwatch log group retention
This function sets a cloudwatch log group retention for 2 weeks.
## Deploy in AWS
When a new cloudwatch log group is created, the funcion will set that cloudwatch log group retention for 2 weeks.
### Setup lambda function
Create a lambda function. Keep node js version 8.10. Otherwise code would not work. Replace your lambda function code with this code https://github.com/tensult/aws-automation-with-lambda/blob/master/set_cloudwatch_log_group_retention/index.js and click on save. Now your lambda function is ready.
### Setup cloudwatch event rule
Under cloudwatch events rules, create a rule by click on `create rule` button. Choose `Event Pattern` under `Event Source`, then select `CloudWatch Logs` as `Service Name` and `AWS API Call via CloudTrail` as `Event Type` and then choose `Specific operation(s)` and write `CreateLogGroup` in below text box. And under `Targets`, select `Lambda function` then under that select that lambda function you created previously and click on `configure details`. And then give a name which is required and click on `create rule`. Now cloudwatch event rule is ready.
## Local installation
Download the package

`git clone https://github.com/tensult/aws-automation-with-lambda.git`

Install dependencies

`npm i`

Go to `aws-automation-with-lambda` directory and install dependencies

`cd aws-automation-with-lambda`

`npm i`

Run `run-locally.js`and pass aws configured profile in your machine after `-p`, function name(eg: `set_cloudwatch_log_group_retention/`) after `-f` and after `-i` object input as string format required for this function to get log group name.

`node run-locally.js node run-locally.js -p PROFILE -r REGION -f set_cloudwatch_log_group_retention/ -i "{\"logGroupName\": \"/aws/lambda/Hello\"}"`

After running `run-locally.js` you can see that cloudwatch log group retention is set for 2 weeks.

# Export cloudwatch logs to S3
This function exports all cloudwatch logs to S3.
## Deploy in AWS
On daily basis one day's cloudwatch logs are exported into S3 bucket. 

**Note:** Lambda function, step functions state machine, S3 bucket, cloudwatch logs should be in same region. Step function is not supported in every region. Check [here](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html#supported-regions) for supported regions.
### Setup lambda function
**Create an iam role and in that create policy with these following permissions:**
- logs:DescribeLogGroups
- logs:CreateExportTask
- logs:DescribeExportTasks
- logs:CreateLogGroup
- logs:CreateLogStream
- logs:PutLogEvents
- s3:PutBucketPolicy
- s3:CreateBucket
- s3:ListBucket

**Create a lambda function:**

Open the AWS Lambda console. Click on `Create a function`. Then choose `Author from scratch`. Then give lambda function name, select `Node.js 8.10` in `Runtime`, select `Choose an existing role` in `Role` and then select that role you created previously and then click on `Create function`. After that in the code editor replace the code with this code https://github.com/tensult/aws-automation-with-lambda/blob/master/export_cloudwatch_logs_to_s3/index.js, set 5 minutes in timeout and then click on `save`.

**Create step functions state machine:**

Go to Step Functions console and click on `Get started`. Choose `Author from scratch`. Then give state machine name, then choose `Create a rule for me` in `IAM role` and put the following json object in `State machine definition`:
```
{
    "StartAt": "CreateExportTask",
    "States": {
        "CreateExportTask": {
            "Type": "Task",
            "Resource": "<lambda-function-arn>",
            "Next": "IsAllLogsExported"
        },
        "IsAllLogsExported": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.continue",
                    "BooleanEquals": true,
                    "Next": "CreateExportTask"
                }
            ],
            "Default": "SuccessState"
        },
        "SuccessState": {
            "Type": "Succeed"
        }
    }
}
```
Put previously created lambda function arn in above json object in `State machine definition`. After that click on `Create state machine`. Now state machine is created. 

**Create a CloudWatch Events rule that triggers on a regular schedule:**

Open the CloudWatch console at https://console.aws.amazon.com/cloudwatch/. In the navigation pane, choose `Events, Create rule`. For `Event source`, choose `Schedule`. Choose `Cron expression` and put `0 10 * * ? *` in `Cron expression`. For more information about cron expression syntax, see [Schedule Expressions for Rules](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html). For `Targets`, choose `Add Target`,  then select `Step Functions state machine`, then under `Configure input` choose `Constant (JSON text)` and in that put the followimg json object:
```
{
  "region": "REGION",   
  "logGroupFilter": "prod",   
  "s3BucketName": "BUCKET_NAME",   
  "logFolderName": "backend" 
}
```
in above json file, `region` is in which region you set up this automation. in `logGroupFilter` give a string, only log groups contain that string will be exported. In `s3BucketName` give bucket name. In S3 that bucket will be created. And in `logFolderName` give a string that folder will be created in that bucket. After that, in `CloudWatch Events needs permission to send events to your Step Functions state machine. By continuing, you are allowing us to do so.` choose `Create a new role for this specific resource`, it will create a role. And then click on `Configure details`. Then give rule name which is required, `state` should be enabled and then click on `Create rule`. Now rule is created.
