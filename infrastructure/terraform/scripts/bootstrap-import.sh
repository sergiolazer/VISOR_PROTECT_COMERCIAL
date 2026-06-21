#!/usr/bin/env bash
# Adopta recursos creados en applies parciales previos (CI sin state remoto).
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PREFIX="${TF_VAR_project_name:-visor-protect}-${TF_VAR_environment:-production}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

import_if_missing() {
  local addr="$1"
  local id="$2"
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    echo "[bootstrap-import] En state: $addr"
    return 0
  fi
  echo "[bootstrap-import] Importando $addr <- $id"
  terraform import -input=false "$addr" "$id" || echo "[bootstrap-import] Omitido $addr (no existe o error)"
}

import_if_missing 'aws_ecr_repository.backend' 'visor-protect-backend'
import_if_missing 'aws_secretsmanager_secret.mongo_uri' "${PREFIX}/mongo-uri"
import_if_missing 'aws_secretsmanager_secret.jwt_secret' "${PREFIX}/jwt-secret"
import_if_missing 'aws_secretsmanager_secret.cloudinary' "${PREFIX}/cloudinary"
import_if_missing 'aws_iam_role.apprunner_ecr_access' "${PREFIX}-apprunner-ecr"
import_if_missing 'aws_iam_role.apprunner_instance' "${PREFIX}-apprunner-instance"
import_if_missing 'aws_iam_openid_connect_provider.github' \
  "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
import_if_missing 'aws_s3_bucket.media' "${PREFIX}-media-${ACCOUNT_ID}"
import_if_missing 'aws_elasticache_subnet_group.redis' "${PREFIX}-redis"

VPC_ID="$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=${PREFIX}-vpc" \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")"
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  import_if_missing 'aws_vpc.main' "$VPC_ID"

  SUBNET_A="$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=${PREFIX}-private-a" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  if [ -n "$SUBNET_A" ] && [ "$SUBNET_A" != "None" ]; then
    import_if_missing 'aws_subnet.private_a' "$SUBNET_A"
  fi

  SUBNET_B="$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=${PREFIX}-private-b" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  if [ -n "$SUBNET_B" ] && [ "$SUBNET_B" != "None" ]; then
    import_if_missing 'aws_subnet.private_b' "$SUBNET_B"
  fi

  SG_CONN="$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PREFIX}-apprunner-connector" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
  if [ -n "$SG_CONN" ] && [ "$SG_CONN" != "None" ]; then
    import_if_missing 'aws_security_group.apprunner_connector' "$SG_CONN"
  fi

  SG_REDIS="$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PREFIX}-redis" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
  if [ -n "$SG_REDIS" ] && [ "$SG_REDIS" != "None" ]; then
    import_if_missing 'aws_security_group.redis' "$SG_REDIS"
  fi
fi

echo "[bootstrap-import] Completado"
