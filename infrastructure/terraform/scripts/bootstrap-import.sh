#!/usr/bin/env bash
# Script de importación para sincronizar terraform.tfstate con AWS.
# Si el recurso existe en AWS pero no en el state, lo importa.
# Los fallos de import se registran; el pipeline solo continúa si el recurso no existe en AWS.

set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="${PROJECT}-backend"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

IMPORT_ERRORS=0

in_state() {
  terraform state show -no-color "$1" >/dev/null 2>&1
}

# import_when_needed <terraform_address> <import_id> [aws_probe_command]
import_when_needed() {
  local addr="$1"
  local id="$2"
  local probe="${3:-}"

  if in_state "$addr"; then
    echo "[bootstrap-import] Ya en state: $addr"
    return 0
  fi

  if [ -n "$probe" ]; then
    if ! bash -c "$probe" >/dev/null 2>&1; then
      echo "[bootstrap-import] No existe en AWS, omitiendo: $addr"
      return 0
    fi
  fi

  echo "[bootstrap-import] Importando $addr <- $id"
  if terraform import -input=false "$addr" "$id"; then
    if in_state "$addr"; then
      echo "[bootstrap-import] OK: $addr"
      return 0
    fi
    echo "::warning::Import reportó éxito pero $addr no está en state"
  else
    echo "::warning::No se pudo importar $addr (id=$id)"
  fi

  IMPORT_ERRORS=$((IMPORT_ERRORS + 1))
  return 0
}

echo "[bootstrap-import] Sincronizando state (prefix=${PREFIX}, account=${ACCOUNT_ID})"

if [ -z "${TF_VAR_github_org:-}" ] || [ -z "${TF_VAR_cors_origin:-}" ]; then
  echo "::warning::TF_VAR_github_org o TF_VAR_cors_origin no definidos — el import de IAM puede fallar"
fi

# --- ECR ---
import_when_needed \
  'aws_ecr_repository.backend' \
  "$ECR_REPO" \
  "aws ecr describe-repositories --repository-names ${ECR_REPO}"

# --- Secrets Manager ---
import_when_needed \
  'aws_secretsmanager_secret.mongo_uri' \
  "${PREFIX}/mongo-uri" \
  "aws secretsmanager describe-secret --secret-id ${PREFIX}/mongo-uri"

import_when_needed \
  'aws_secretsmanager_secret.jwt_secret' \
  "${PREFIX}/jwt-secret" \
  "aws secretsmanager describe-secret --secret-id ${PREFIX}/jwt-secret"

import_when_needed \
  'aws_secretsmanager_secret.cloudinary' \
  "${PREFIX}/cloudinary" \
  "aws secretsmanager describe-secret --secret-id ${PREFIX}/cloudinary"

# --- IAM (OIDC antes que roles que referencian su ARN) ---
import_when_needed \
  'aws_iam_openid_connect_provider.github' \
  "$OIDC_ARN" \
  "aws iam get-open-id-connect-provider --open-id-connect-provider-arn ${OIDC_ARN}"

import_when_needed \
  'aws_iam_role.apprunner_ecr_access' \
  "${PREFIX}-apprunner-ecr" \
  "aws iam get-role --role-name ${PREFIX}-apprunner-ecr"

import_when_needed \
  'aws_iam_role.apprunner_instance' \
  "${PREFIX}-apprunner-instance" \
  "aws iam get-role --role-name ${PREFIX}-apprunner-instance"

import_when_needed \
  'aws_iam_role.github_deploy' \
  "${PREFIX}-github-deploy" \
  "aws iam get-role --role-name ${PREFIX}-github-deploy"

import_when_needed \
  'aws_iam_role_policy.github_deploy' \
  "${PREFIX}-github-deploy:${PREFIX}-github-deploy" \
  "aws iam get-role-policy --role-name ${PREFIX}-github-deploy --policy-name ${PREFIX}-github-deploy"

# --- S3 ---
import_when_needed \
  'aws_s3_bucket.media' \
  "${PREFIX}-media-${ACCOUNT_ID}" \
  "aws s3api head-bucket --bucket ${PREFIX}-media-${ACCOUNT_ID}"

# --- ElastiCache ---
import_when_needed \
  'aws_elasticache_subnet_group.redis' \
  "${PREFIX}-redis" \
  "aws elasticache describe-cache-subnet-groups --cache-subnet-group-name ${PREFIX}-redis"

import_when_needed \
  'aws_elasticache_cluster.redis' \
  "${PREFIX}-redis" \
  "aws elasticache describe-cache-clusters --cache-cluster-id ${PREFIX}-redis"

# --- VPC / networking (IDs descubiertos por tags) ---
VPC_ID="$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=${PREFIX}-vpc" \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")"

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  import_when_needed 'aws_vpc.main' "$VPC_ID"

  SUBNET_A="$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=${PREFIX}-private-a" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  if [ -n "$SUBNET_A" ] && [ "$SUBNET_A" != "None" ]; then
    import_when_needed 'aws_subnet.private_a' "$SUBNET_A"
  fi

  SUBNET_B="$(aws ec2 describe-subnets \
    --filters "Name=tag:Name,Values=${PREFIX}-private-b" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  if [ -n "$SUBNET_B" ] && [ "$SUBNET_B" != "None" ]; then
    import_when_needed 'aws_subnet.private_b' "$SUBNET_B"
  fi

  SG_CONN="$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PREFIX}-apprunner-connector" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
  if [ -n "$SG_CONN" ] && [ "$SG_CONN" != "None" ]; then
    import_when_needed 'aws_security_group.apprunner_connector' "$SG_CONN"
  fi

  SG_REDIS="$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PREFIX}-redis" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
  if [ -n "$SG_REDIS" ] && [ "$SG_REDIS" != "None" ]; then
    import_when_needed 'aws_security_group.redis' "$SG_REDIS"
  fi
fi

# --- App Runner (solo si ENABLE_APP_RUNNER=true y el servicio existe) ---
if [ "${TF_VAR_enable_app_runner:-false}" = "true" ]; then
  import_when_needed \
    'aws_cloudwatch_log_group.apprunner[0]' \
    "/aws/apprunner/${PREFIX}-backend" \
    "aws logs describe-log-groups --log-group-name-prefix /aws/apprunner/${PREFIX}-backend"

  AS_ARN="$(aws apprunner list-auto-scaling-configurations \
    --query "AutoScalingConfigurationSummaryList[?AutoScalingConfigurationName=='${PREFIX}-backend-as'].AutoScalingConfigurationArn | [0]" \
    --output text 2>/dev/null || echo "")"
  if [ -n "$AS_ARN" ] && [ "$AS_ARN" != "None" ]; then
    import_when_needed 'aws_apprunner_auto_scaling_configuration_version.backend[0]' "$AS_ARN"
  fi

  VC_ARN="$(aws apprunner list-vpc-connectors \
    --query "VpcConnectors[?VpcConnectorName=='${PREFIX}-connector'].VpcConnectorArn | [0]" \
    --output text 2>/dev/null || echo "")"
  if [ -n "$VC_ARN" ] && [ "$VC_ARN" != "None" ]; then
    import_when_needed 'aws_apprunner_vpc_connector.main[0]' "$VC_ARN"
  fi

  SVC_ARN="$(aws apprunner list-services \
    --query "ServiceSummaryList[?ServiceName=='${PREFIX}-backend'].ServiceArn | [0]" \
    --output text 2>/dev/null || echo "")"
  if [ -n "$SVC_ARN" ] && [ "$SVC_ARN" != "None" ]; then
    import_when_needed 'aws_apprunner_service.backend[0]' "$SVC_ARN"
  fi
fi

echo "[bootstrap-import] Completado (import warnings: ${IMPORT_ERRORS})"
