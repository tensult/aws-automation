# stop_running_ec2_instances lambda function
This function stops running AWS EC2 instances of all regions based on instance tag. Here we are using `donotstop` tag. If you mention `donotstop` as tag key only in EC2 instance, only that instance will be stopped.

# Local installation

Download from Github

`git clone https://github.com/tensult/aws-automation-with-lambda.git`

Go into function directory and download dependencies

```
cd aws-automation-with-lambda
npm install
```

Run the function

`node index.js`

**Note:** It will take default configured AWS credential from your machine. If you want to test for another AWS account follow below.

Pass AWS profile which is configured in your machine

`node test.js --profile PROFILE`

# Deploy in AWS

## Setup Lambda function
For getting help to create AWS Lambda function, check this [link](https://docs.aws.amazon.com/lambda/latest/dg/get-started-create-function.html)

**Note:** When you create Lambda function, select Node.js 8.10 because given Lambda function code is supported only in or after Node.js 8.10

After creating Lambda function put given code in index.js file into newly created Lambda function in your AWS account and save it.  

## Setup Cloudwatch event rule
Create Cloudwatch event rule for triggering a Lambda function once in a day to stop running EC2 instances.
### Steps:
![screen shot 2018-04-20 at 3 42 44 pm](https://user-images.githubusercontent.com/30007458/39045832-b89b2a6a-44b1-11e8-9e3d-e2e07deeb01d.png)
**Step 1:** In AWS Cloudwatch service, create a event rule and in that under schedule create a cron expression to set a time when it will trigger a AWS Lambda function. For getting help in how to create cron expression check this [link](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html)

![screen shot 2018-04-20 at 4 18 13 pm](https://user-images.githubusercontent.com/30007458/39047196-9efd808a-44b6-11e8-92f6-7a7f324594ae.png)
**Step 2:** After creating cron expression, at right side under `Targets` first select `Lambda function` and then select the Lambda function which you want to triggered. And then click on `configure details`.

![screen shot 2018-04-20 at 4 33 06 pm](https://user-images.githubusercontent.com/30007458/39047845-05925148-44b9-11e8-8bf5-c2f26f6d46f4.png)
**Step 3:** After that this page will come. Here write event rule name which is required and also you can give description. And then click on `create rule` and also make sure that `state` should be enabled. Now event rule is created.
