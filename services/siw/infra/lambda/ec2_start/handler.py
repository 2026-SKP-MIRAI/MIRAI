import os

import boto3


def lambda_handler(event, context):
    region = "ap-northeast-2"
    instance_id = os.environ["EC2_INSTANCE_ID"]

    ec2 = boto3.client("ec2", region_name=region)
    response = ec2.start_instances(InstanceIds=[instance_id])

    state = response["StartingInstances"][0]["CurrentState"]["Name"]
    print(f"EC2 {instance_id} start requested. Current state: {state}")

    return {"instanceId": instance_id, "state": state}
