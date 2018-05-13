
# AWS Automation with Lambda
- [Set cloudwatch log group retention](#set-cloudwatch-log-group-retention)
# Set cloudwatch log group retention
This function sets a cloudwatch log group retention for 2 weeks.
## Deploy in AWS
When a new cloudwatch log group is created, the funcion will set that cloudwatch log group retention for 2 weeks.
### Setup lambda function
Create a lambda function. Keep node js version 8.10. Otherwise code would not work. Replace your lambda function code with this code https://github.com/tensult/aws-automation-with-lambda/blob/master/set_cloudwatch_log_group_retention/index.js and click on save. Now your lambda function is ready.
### Setup cloudwatch event rule
Under cloudwatch events rules, create a rule by click on `create rule` button. Choose `Event Pattern` under `Event Source`, then select `CloudWatch Logs` as `Service Name` and `AWS API Call via CloudTrail` as `Event Type` and then choose `Specific operation(s)` and write `CreateLogGroup` in below text box. And under `Targets`, select `Lambda function` then under that select that lambda function you created previously and click on `configure details`. And then give a name which is required and click on `create rule`. Now cloudwatch event rule is ready.
## Local installation
Download the package and go to that directory

`git clone https://github.com/tensult/aws-automation-with-lambda.git`

`cd aws-automation-with-lambda`

Run `run-locally.js`and pass aws configured profile in your machine after `-p`, function name(eg: `set_cloudwatch_log_group_retention/`) after `-f` and after `-i` object input as string format required for this function to get log group name.

`node run-locally.js node run-locally.js -p PROFILE -r REGION -f set_cloudwatch_log_group_retention/ -i "{\"logGroupName\": \"/aws/lambda/Hello\"}"`

After running `run-locally.js` you can see that cloudwatch log group retention is set for 2 weeks.
