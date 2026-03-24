import sys
import os
import pytest
from unittest.mock import MagicMock

# dags/ 디렉토리를 직접 sys.path에 추가 — job_crawl_dag를 직접 임포트 가능
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "dags"))

# airflow 패키지 mock (로컬 Python 3.14 — Airflow는 3.12까지만 공식 지원)
# DAG mock: 생성 시 kwargs를 실제 속성으로 저장하여 schedule_interval 등 검증 가능
class _FakeDAG:
    def __init__(self, *args, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        self.dag_id = kwargs.get("dag_id", "")

_dag_module = MagicMock()
_dag_module.DAG = _FakeDAG

_variable = MagicMock()

_python_op = MagicMock()
_python_op.PythonOperator = MagicMock(return_value=MagicMock())

sys.modules.update({
    "airflow": _dag_module,
    "airflow.models": _variable,
    "airflow.models.variable": _variable,
    "airflow.operators": MagicMock(),
    "airflow.operators.python": _python_op,
})

# Variable은 테스트별로 patch("job_crawl_dag.Variable.get")으로 오버라이드
from airflow.models import Variable  # noqa: E402


@pytest.fixture
def mock_ti():
    ti = MagicMock()
    ti.xcom_pull.return_value = None
    return ti
