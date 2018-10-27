#!/bin/bash

ip=`curl -s https://api.ipify.org`

aws ec2 authorize-security-group-ingress --protocol tcp --port 22 --cidr $ip/32 --group-id $1

# To run:
# AWS_PROFILE=aia-dev AWS_REGION=us-east-1 sh add-my-ip-to-security-group.sh <group-id>