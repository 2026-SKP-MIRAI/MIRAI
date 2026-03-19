import os

import boto3


def lambda_handler(event, context):
    region = "ap-northeast-2"
    instance_id = os.environ["EC2_INSTANCE_ID"]

    ec2 = boto3.client("ec2", region_name=region)
    response = ec2.stop_instances(InstanceIds=[instance_id])

    state = response["StoppingInstances"][0]["CurrentState"]["Name"]
    print(f"EC2 {instance_id} stop requested. Current state: {state}")

    return {"instanceId": instance_id, "state": state}
