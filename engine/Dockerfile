FROM python:3.12-slim

# 로그 버퍼링 비활성화 (stdout 실시간 출력)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 의존성만 먼저 복사 → 캐시 레이어 최적화
# (코드만 변경 시 pip install 재실행 안 함)
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# 앱 소스 복사
COPY app/ app/

# 보안: non-root user 실행
RUN useradd -m appuser
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
