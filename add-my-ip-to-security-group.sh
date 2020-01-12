#!/bin/bash

# Requires AWS CLI

ip=`curl -s https://api.ipify.org`

aws ec2 authorize-security-group-ingress --protocol tcp --port 22 --cidr $ip/32 --group-id $1

# To run:
# AWS_PROFILE=<aws-profile> AWS_REGION=<aws-region> sh add-my-ip-to-security-group.sh <group-id>