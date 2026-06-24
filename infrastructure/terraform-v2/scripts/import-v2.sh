#!/usr/bin/env bash
# Importa recursos existentes en AWS al state de terraform-v2 (módulos).
# Uso:
#   cd infrastructure/terraform-v2/environments/production
#   terraform init -backend-config=../../backend.hcl
#   bash ../../scripts/import-v2.sh
#
# NO importa VPC/subnets (modo discover_existing_network=true — solo data sources).
# NO importa aws_ecs_service si no está ACTIVE en AWS.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/environments/production"
cd "$TF_DIR"

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"
AWS_REGION="${TF_VAR_aws_region:-sa-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="${PROJECT}-backend"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
MEDIA_BUCKET="${PREFIX}-media-${ACCOUNT_ID}"
VPC_ANCHOR="${VPC_ANCHOR_ID:-vpc-05414285d00010eff}"

# shellcheck source=../../terraform/scripts/aws-probe.sh
source "${ROOT}/../terraform/scripts/aws-probe.sh" 2>/dev/null || true

IMPORTED=0
SKIPPED=0
FAILED=0

tf_import() {
  local addr="$1"
  local id="$2"

  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    echo "[import-v2] skip (en state): $addr"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  echo "[import-v2] $addr <- $id"
  if terraform import -input=false "$addr" "$id"; then
    IMPORTED=$((IMPORTED + 1))
    return 0
  fi

  echo "::warning::Falló import: $addr"
  FAILED=$((FAILED + 1))
  return 0
}

discover_sg() {
  local name="$1"
  aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${VPC_ANCHOR}" "Name=group-name,Values=${name}" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo ""
}

discover_alb_arn() {
  aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?LoadBalancerName=='${PREFIX}-backend'].LoadBalancerArn | [0]" \
    --output text 2>/dev/null || echo ""
}

echo "[import-v2] Cuenta=${ACCOUNT_ID} región=${AWS_REGION} prefix=${PREFIX}"
echo "[import-v2] VPC ancla=${VPC_ANCHOR} (solo referencia; red vía data sources)"

# --- Tier 0: security + storage ---
tf_import 'module.security.aws_iam_openid_connect_provider.github' "$OIDC_ARN"

tf_import 'module.security.aws_secretsmanager_secret.mongo_uri' "${PREFIX}/mongo-uri"
tf_import 'module.security.aws_secretsmanager_secret.jwt_secret' "${PREFIX}/jwt-secret"
tf_import 'module.security.aws_secretsmanager_secret.cloudinary' "${PREFIX}/cloudinary"

tf_import 'module.storage.aws_s3_bucket.media' "$MEDIA_BUCKET"
tf_import 'module.storage.aws_ecr_repository.backend' "$ECR_REPO"

tf_import 'module.security.aws_iam_role.github_deploy' "${PREFIX}-github-deploy"
tf_import 'module.security.aws_iam_role_policy.github_deploy' "${PREFIX}-github-deploy:${PREFIX}-github-deploy"

# --- Tier 1: database ---
SG_REDIS="$(aws elasticache describe-cache-clusters \
  --cache-cluster-id "${PREFIX}-redis" \
  --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text 2>/dev/null || echo "")"
if [ -z "$SG_REDIS" ] || [ "$SG_REDIS" = "None" ]; then
  SG_REDIS="$(discover_sg "${PREFIX}-redis")"
fi
tf_import 'module.database.aws_security_group.redis' "$SG_REDIS"
tf_import 'module.database.aws_elasticache_subnet_group.redis' "${PREFIX}-redis"
tf_import 'module.database.aws_elasticache_cluster.redis' "${PREFIX}-redis"

# --- Tier 2: IAM ECS + compute (si existen) ---
if aws iam get-role --role-name "${PREFIX}-ecs-execution" >/dev/null 2>&1; then
  tf_import 'module.security.aws_iam_role.ecs_execution' "${PREFIX}-ecs-execution"
  tf_import 'module.security.aws_iam_role_policy_attachment.ecs_execution_managed' \
    "${PREFIX}-ecs-execution/arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  tf_import 'module.security.aws_iam_role_policy.ecs_execution_secrets' \
    "${PREFIX}-ecs-execution:${PREFIX}-ecs-execution-secrets"
fi

if aws iam get-role --role-name "${PREFIX}-ecs-task" >/dev/null 2>&1; then
  tf_import 'module.security.aws_iam_role.ecs_task' "${PREFIX}-ecs-task"
  tf_import 'module.security.aws_iam_role_policy.ecs_task' "${PREFIX}-ecs-task:${PREFIX}-ecs-task"
fi

ALB_ARN="$(discover_alb_arn)"
if aws_value_ok "$ALB_ARN" 2>/dev/null; then
  tf_import 'module.compute[0].aws_lb.backend' "$ALB_ARN"

  TG_ARN="$(aws elbv2 describe-target-groups --names "${PREFIX}-backend" \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")"
  if ! aws_value_ok "$TG_ARN" 2>/dev/null; then
    TG_ARN="$(aws elbv2 describe-target-groups \
      --query "TargetGroups[?TargetGroupName=='${PREFIX}-backend'].TargetGroupArn | [0]" \
      --output text 2>/dev/null || echo "")"
  fi
  tf_import 'module.compute[0].aws_lb_target_group.backend' "$TG_ARN"

  LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
    --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text 2>/dev/null || echo "")"
  tf_import 'module.compute[0].aws_lb_listener.http' "$LISTENER_ARN"

  SG_ALB="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
    --query 'LoadBalancers[0].SecurityGroups[0]' --output text 2>/dev/null || echo "")"
  if ! aws_value_ok "$SG_ALB" 2>/dev/null; then
    SG_ALB="$(discover_sg "${PREFIX}-alb")"
  fi
  tf_import 'module.compute[0].aws_security_group.alb' "$SG_ALB"
fi

SG_ECS="$(discover_sg "${PREFIX}-ecs")"
if aws_value_ok "$SG_ECS" 2>/dev/null; then
  tf_import 'module.compute[0].aws_security_group.ecs_tasks' "$SG_ECS"
fi

if aws ecs describe-clusters --clusters "${PREFIX}-backend" \
  --query 'clusters[?status==`ACTIVE`].clusterName' --output text 2>/dev/null | grep -q .; then
  tf_import 'module.compute[0].aws_ecs_cluster.backend' "${PREFIX}-backend"
fi

LOG_GROUP="/ecs/${PREFIX}-backend"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" \
  --query "logGroups[?logGroupName=='${LOG_GROUP}'].logGroupName | [0]" --output text 2>/dev/null | grep -q .; then
  tf_import 'module.compute[0].aws_cloudwatch_log_group.ecs' "$LOG_GROUP"
fi

# ECS service — NUNCA importar si no está ACTIVE (apply lo crea).
if declare -F ecs_service_arn >/dev/null 2>&1 && ecs_service_arn "$PREFIX" >/dev/null 2>&1; then
  echo "[import-v2] ECS service ACTIVE detectado — import manual opcional tras validar plan:"
  echo "  terraform import 'module.compute[0].aws_ecs_service.backend' '${PREFIX}-backend/${PREFIX}-backend'"
else
  echo "[import-v2] ECS service ausente — se creará en apply"
  if terraform state show -no-color 'module.compute[0].aws_ecs_service.backend' >/dev/null 2>&1; then
    echo "[import-v2] purgando state huérfano ecs_service..."
    terraform state rm 'module.compute[0].aws_ecs_service.backend' 2>/dev/null || true
  fi
fi

# S3 sub-resources y ECR lifecycle se alinean en apply (no requieren import separado en la mayoría de casos).

echo "[import-v2] Completado: importados=${IMPORTED} omitidos=${SKIPPED} fallos=${FAILED}"
echo "[import-v2] Siguiente: terraform plan -var-file=../../terraform.tfvars"
exit 0
