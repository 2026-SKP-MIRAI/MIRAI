import sys
import os

import pytest
from moto import mock_aws

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ec2_stop"))
import handler as ec2_stop_handler


@mock_aws
def test_stop_returns_instance_id_and_state(ec2_instance, monkeypatch):
    monkeypatch.setenv("EC2_INSTANCE_ID", ec2_instance)

    result = ec2_stop_handler.lambda_handler({}, None)

    assert result["instanceId"] == ec2_instance
    assert "state" in result


@mock_aws
def test_stop_missing_instance_id_raises(aws_env, monkeypatch):
    monkeypatch.delenv("EC2_INSTANCE_ID", raising=False)

    with pytest.raises(KeyError):
        ec2_stop_handler.lambda_handler({}, None)
