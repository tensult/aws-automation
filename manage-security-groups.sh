#!/bin/bash
for i in "$@"
do
case $i in 
    -s=*|--status=*)
    status="${i#*=}"
    shift
    ;;
    -p=*|--profile=*)
    profile="${i#*=}"
    shift
    ;;
    -P=*|--port=*)
    port="${i#*=}"
    shift
    ;;
    -g=*|--group=*)
    group="${i#*=}"
    shift
    ;;
esac
done
if [ -z "$profile" ]
then
    echo "Pass AWS profile name using --profile=<profile-name> or -p=<profile-name>"
    exit -1
elif [ -z "$status" ]
then
    echo "Pass status using --status=<status> or -s=<status>"
    exit -1
elif [ -z "$port" ]
then
    echo "Pass port using --port=<port> or -P=<port>"
    exit -1
elif [ -z "$group" ]
then
    echo "Pass group using --group=<group> or -g=<group>"
    exit -1
fi
if [ $status == "open" ]
then
aws ec2 --profile $profile authorize-security-group-ingress --group-id $group --protocol tcp --port $port --cidr 0.0.0.0/0
elif [ $status == "close" ]
then
aws ec2 --profile $profile revoke-security-group-ingress --group-id $group --protocol tcp --port $port --cidr 0.0.0.0/0
fi
