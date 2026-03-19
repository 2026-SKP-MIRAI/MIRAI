import boto3
import pytest
from moto import mock_aws


@pytest.fixture
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-northeast-2")


@pytest.fixture
def ec2_instance(aws_env):
    """mock_aws 컨텍스트 안에서 가상 인스턴스를 생성한다.
    테스트 함수도 @mock_aws로 감싸야 동일 mock 컨텍스트를 공유한다."""
    with mock_aws():
        ec2 = boto3.resource("ec2", region_name="ap-northeast-2")
        instances = ec2.create_instances(
            ImageId="ami-00000000",
            MinCount=1,
            MaxCount=1,
            InstanceType="t3.small",
        )
        yield instances[0].id
