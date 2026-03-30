import sys
import os
import pytest
from unittest.mock import MagicMock

# dags/ 디렉토리를 직접 sys.path에 추가 — seung_analytics_dag를 직접 임포트 가능
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "dags"))

# airflow 패키지 mock (로컬 Python 3.14 — Airflow는 3.12까지만 공식 지원)
_dag = MagicMock()
_dag.DAG = MagicMock(return_value=MagicMock())

_variable = MagicMock()

_python_op = MagicMock()
_python_op.PythonOperator = MagicMock(return_value=MagicMock())

_exceptions = MagicMock()
_exceptions.AirflowSkipException = type("AirflowSkipException", (Exception,), {})

_boto3 = MagicMock()
_psycopg2 = MagicMock()
_feedparser = MagicMock()

sys.modules.update({
    "airflow": _dag,
    "airflow.models": _variable,
    "airflow.models.variable": _variable,
    "airflow.operators": MagicMock(),
    "airflow.operators.python": _python_op,
    "airflow.exceptions": _exceptions,
    "airflow.hooks": MagicMock(),
    "airflow.hooks.base": MagicMock(),
    "boto3": _boto3,
    "psycopg2": _psycopg2,
    "psycopg2.extras": MagicMock(),
    "feedparser": _feedparser,
})

# Variable은 테스트별로 patch("seung_analytics_dag.Variable.get")으로 오버라이드
from airflow.models import Variable  # noqa: E402


@pytest.fixture
def mock_ti():
    ti = MagicMock()
    ti.xcom_pull.return_value = None
    return ti
