#!/bin/bash
# Airflow EC2 스케줄 자동 on/off — Lambda + EventBridge 배포 스크립트
# 사전 조건:
#   - AWS CLI 설치 및 aws configure 완료
#   - EC2_INSTANCE_ID 환경변수 설정
#   - LAMBDA_ROLE_ARN 환경변수 설정 (Lambda 실행 역할 ARN)
#
# 사용법:
#   export EC2_INSTANCE_ID=i-0123456789abcdef0
#   export LAMBDA_ROLE_ARN=arn:aws:iam::123456789012:role/lambda-ec2-scheduler
#   ./deploy.sh

set -e

REGION="ap-northeast-2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
EC2_INSTANCE_ID="${EC2_INSTANCE_ID:?EC2_INSTANCE_ID 환경변수를 설정하세요 (예: i-0123456789abcdef0)}"
LAMBDA_ROLE_ARN="${LAMBDA_ROLE_ARN:?LAMBDA_ROLE_ARN 환경변수를 설정하세요}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Airflow EC2 스케줄러 배포 ==="
echo "  Region:      $REGION"
echo "  Account:     $ACCOUNT_ID"
echo "  Instance ID: $EC2_INSTANCE_ID"
echo ""

# ── ec2-start Lambda ──────────────────────────────────────────────────
echo "[1/5] ec2-start Lambda 배포..."
cd "$SCRIPT_DIR/lambda/ec2_start"
zip -q function.zip handler.py

if aws lambda get-function --function-name ec2-start --region "$REGION" &>/dev/null; then
  aws lambda update-function-code \
    --function-name ec2-start \
    --zip-file fileb://function.zip \
    --region "$REGION" > /dev/null
  aws lambda wait function-updated --function-name ec2-start --region "$REGION"
  aws lambda update-function-configuration \
    --function-name ec2-start \
    --environment "Variables={EC2_INSTANCE_ID=$EC2_INSTANCE_ID}" \
    --region "$REGION" > /dev/null
  echo "  → ec2-start 업데이트 완료"
else
  aws lambda create-function \
    --function-name ec2-start \
    --runtime python3.12 \
    --handler handler.lambda_handler \
    --role "$LAMBDA_ROLE_ARN" \
    --zip-file fileb://function.zip \
    --environment "Variables={EC2_INSTANCE_ID=$EC2_INSTANCE_ID}" \
    --region "$REGION" > /dev/null
  echo "  → ec2-start 생성 완료"
fi
rm function.zip

# ── ec2-stop Lambda ───────────────────────────────────────────────────
echo "[2/5] ec2-stop Lambda 배포..."
cd "$SCRIPT_DIR/lambda/ec2_stop"
zip -q function.zip handler.py

if aws lambda get-function --function-name ec2-stop --region "$REGION" &>/dev/null; then
  aws lambda update-function-code \
    --function-name ec2-stop \
    --zip-file fileb://function.zip \
    --region "$REGION" > /dev/null
  aws lambda wait function-updated --function-name ec2-stop --region "$REGION"
  aws lambda update-function-configuration \
    --function-name ec2-stop \
    --environment "Variables={EC2_INSTANCE_ID=$EC2_INSTANCE_ID}" \
    --region "$REGION" > /dev/null
  echo "  → ec2-stop 업데이트 완료"
else
  aws lambda create-function \
    --function-name ec2-stop \
    --runtime python3.12 \
    --handler handler.lambda_handler \
    --role "$LAMBDA_ROLE_ARN" \
    --zip-file fileb://function.zip \
    --environment "Variables={EC2_INSTANCE_ID=$EC2_INSTANCE_ID}" \
    --region "$REGION" > /dev/null
  echo "  → ec2-stop 생성 완료"
fi
rm function.zip

START_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:ec2-start"
STOP_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:ec2-stop"

# ── EventBridge Rules ─────────────────────────────────────────────────
echo "[3/5] EventBridge 규칙 설정..."
aws events put-rule \
  --name "airflow-ec2-start" \
  --schedule-expression "cron(45 14 * * ? *)" \
  --description "Airflow EC2 시작 — UTC 14:45 (KST 23:45)" \
  --state ENABLED \
  --region "$REGION" > /dev/null

aws events put-rule \
  --name "airflow-ec2-stop" \
  --schedule-expression "cron(0 16 * * ? *)" \
  --description "Airflow EC2 중지 — UTC 16:00 (KST 01:00)" \
  --state ENABLED \
  --region "$REGION" > /dev/null
echo "  → EventBridge 규칙 설정 완료"

# ── EventBridge Targets ───────────────────────────────────────────────
echo "[4/5] EventBridge 타겟 연결..."
aws events put-targets \
  --rule "airflow-ec2-start" \
  --targets "Id=ec2-start,Arn=$START_ARN" \
  --region "$REGION" > /dev/null

aws events put-targets \
  --rule "airflow-ec2-stop" \
  --targets "Id=ec2-stop,Arn=$STOP_ARN" \
  --region "$REGION" > /dev/null
echo "  → 타겟 연결 완료"

# ── Lambda 호출 권한 (멱등) ───────────────────────────────────────────
echo "[5/5] Lambda 호출 권한 설정..."
aws lambda add-permission \
  --function-name ec2-start \
  --statement-id eventbridge-start \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/airflow-ec2-start" \
  --region "$REGION" 2>/dev/null || true

aws lambda add-permission \
  --function-name ec2-stop \
  --statement-id eventbridge-stop \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/airflow-ec2-stop" \
  --region "$REGION" 2>/dev/null || true
echo "  → Lambda 호출 권한 설정 완료"

echo ""
echo "✓ 배포 완료"
echo "  ec2-start: cron(45 14 * * ? *) = 매일 UTC 14:45 (KST 23:45)"
echo "  ec2-stop:  cron(0 16 * * ? *)  = 매일 UTC 16:00 (KST 01:00)"
