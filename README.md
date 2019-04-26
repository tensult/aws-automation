# AWS Automation
| Lambda functions and Scripts | Documentation |
|-----------------------------------------|-------|
| Export CloudWatch logs to S3| <a href="https://medium.com/tensult/exporting-of-aws-cloudwatch-logs-to-s3-using-automation-2627b1d2ee37"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| CloudWatch logs group retention | <a href="https://medium.com/tensult/manage-aws-cloudwatch-log-group-retention-using-automation-26add478b0c5"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| EC2 automated Snapshots | <a href="https://medium.com/tensult/automating-ec2-snapshot-creation-in-aws-8aa5b4b6203"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| DynamoDB Table Backup | <a href="https://medium.com/tensult/aws-dynamodb-point-in-time-recovery-e8711d6d04cb"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Lambda Function Tuning | <a href="https://medium.com/tensult/send-lambda-functions-usage-metrics-to-amazon-cloudwatch-for-tuning-4d5ed69341b0"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Update Lambda Functions Timeout | <a href="https://github.com/tensult/aws-automation/blob/master/update_timeout_for_lambda_functions.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Update Lambda Functions Memory | <a href="https://github.com/tensult/aws-automation/blob/master/update_memory_for_lambda_functions.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Update Lambda Functions Run Time | <a href="https://github.com/tensult/aws-automation/blob/master/update_runtime_for_lambda_functions.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Update Lambda Functions Environment Variable | <a href="https://github.com/tensult/aws-automation/blob/master/update_environment_variable_for_lambda_functions.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Set Invocations Alarm for Lambda Functions | <a href="https://github.com/tensult/aws-automation/blob/master/set_lambda_function_invocation_count_alarm.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Enable all ApiGateway APIs logging to CLoudWatch | <a href="https://github.com/tensult/aws-automation/blob/master/enable_cloudwatch_logs_for_apis.js"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |
| Stop running EC2 instances | <a href="https://github.com/tensult/aws-automation/blob/master/stop_running_ec2_instances/README.md"><img src="https://cdn0.iconfinder.com/data/icons/relief-document-glyph-1/32/file-text-document-512.png" width="30px" height="30px"></a> |

# Brightcove videos retranscode
First we fetch all videos data and store it as a json file in local. Here we fetch 20 videos and retrancode them at a time.
### Step 1: Fetch all videos data and store in local 
Execute the following command in terminal to store videos data in local :

`$ CLIENT_SECRET=<CLIENT_SECRET> CLIENT_ID=<CLIENT_ID> BRIGHTCOVE_ACCOUNT_ID=<BRIGHTCOVE_ACCOUNT_ID> FUNCTION_NAME=storeBrightcoveVideoDataInJson FILE_DIR_PATH=<FILE_DIR_PATH> node brighcove_videos_bulk_retranscode.js`

### Step 2: Retranscode videos
Execute the following command in terminal to retranscode videos :

`$ sh brightcove_all_videos_retranscode.sh <FILE_DIR_PATH>`