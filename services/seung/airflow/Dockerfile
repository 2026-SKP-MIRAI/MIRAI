FROM apache/airflow:2.9.0

USER airflow
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt \
    --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.9.0/constraints-3.11.txt"
# dags/는 docker-compose.yml volume mount로 주입됨 — COPY 불필요
