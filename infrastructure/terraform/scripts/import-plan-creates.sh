#!/usr/bin/env bash
# Importa recursos que el plan marca como "create" pero ya existen en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PLAN_FILE="$(basename "${1:-pre-apply.plan}")"
[ -f "$PLAN_FILE" ] || exit 0

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"
AWS_REGION="${TF_VAR_aws_region:-sa-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="${PROJECT}-backend"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

# shellcheck source=aws-probe.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aws-probe.sh"
# shellcheck source=import-shared.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/import-shared.sh"
# shellcheck source=terraform-import-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/terraform-import-lib.sh"

IMPORT_TIMEOUT="${TF_IMPORT_TIMEOUT_SEC:-180}"

import_if_planned_create() {
  local addr="$1"
  local aws_id="$2"
  local probe="${3:-}"

  [ -z "$aws_id" ] || [ "$aws_id" = "None" ] && return 0

  if ! terraform show -json "$PLAN_FILE" | jq -e --arg a "$addr" '
    [.resource_changes[]
      | select(.address == $a)
      | select([.change.actions[]] | any(. == "create"))
    ] | length > 0
  ' >/dev/null 2>&1; then
    return 0
  fi

  if [ -n "$probe" ] && ! aws_probe_ok "$probe"; then
    echo "[import-plan-creates] $addr planeado create pero no existe en AWS — OK"
    return 0
  fi

  echo "[import-plan-creates] $addr <- $aws_id"
  if ! run_terraform_import "$addr" "$aws_id"; then
    local import_ec=$?
    if [ "$import_ec" -eq 124 ]; then
      echo "::warning::Import de $addr excedió ${IMPORT_TIMEOUT}s"
    else
      echo "::warning::Import falló: $addr"
    fi
  fi
}

echo "[import-plan-creates] Procesando creates del plan..."

import_shared_resources planned "$PLAN_FILE"

VPC_ID=""
CACHE_SUBNET="$(aws elasticache describe-cache-clusters \
  --cache-cluster-id "${PREFIX}-redis" \
  --query 'CacheClusters[0].CacheSubnetGroupName' --output text 2>/dev/null || echo "")"
if [ -n "$CACHE_SUBNET" ] && [ "$CACHE_SUBNET" != "None" ]; then
  SUBNET_REF="$(aws elasticache describe-cache-subnet-groups \
    --cache-subnet-group-name "$CACHE_SUBNET" \
    --query 'CacheSubnetGroups[0].Subnets[0].SubnetIdentifier' --output text 2>/dev/null || echo "")"
  if [ -n "$SUBNET_REF" ] && [ "$SUBNET_REF" != "None" ]; then
    VPC_ID="$(aws ec2 describe-subnets --subnet-ids "$SUBNET_REF" \
      --query 'Subnets[0].VpcId' --output text 2>/dev/null || echo "")"
  fi
fi

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  import_if_planned_create 'aws_vpc.main' "$VPC_ID" "aws ec2 describe-vpcs --vpc-ids $VPC_ID"
fi

SG_REDIS="$(aws elasticache describe-cache-clusters --cache-cluster-id "${PREFIX}-redis" --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text 2>/dev/null || echo "")"
if [ -z "$SG_REDIS" ] || [ "$SG_REDIS" = "None" ]; then
  SG_REDIS="$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${PREFIX}-redis" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
fi
import_if_planned_create 'aws_security_group.redis' "$SG_REDIS" "aws ec2 describe-security-groups --group-ids $SG_REDIS"

SG_ALB=""
ALB_ARN_FOR_SG="$(aws elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='${PREFIX}-backend'].LoadBalancerArn | [0]" --output text 2>/dev/null || echo "")"
if aws_value_ok "$ALB_ARN_FOR_SG"; then
  SG_ALB="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN_FOR_SG" --query 'LoadBalancers[0].SecurityGroups[0]' --output text 2>/dev/null || echo "")"
fi
if ! aws_value_ok "$SG_ALB" && [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  SG_ALB="$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${PREFIX}-alb" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
fi
import_if_planned_create 'aws_security_group.alb[0]' "$SG_ALB" "aws ec2 describe-security-groups --group-ids $SG_ALB"

SG_ECS=""
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  SG_ECS="$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${PREFIX}-ecs" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
fi
import_if_planned_create 'aws_security_group.ecs_tasks[0]' "$SG_ECS" "aws ec2 describe-security-groups --group-ids $SG_ECS"

import_if_planned_create \
  'aws_iam_role.ecs_execution[0]' \
  "${PREFIX}-ecs-execution" \
  "aws iam get-role --role-name ${PREFIX}-ecs-execution"

import_if_planned_create \
  'aws_iam_role.ecs_task[0]' \
  "${PREFIX}-ecs-task" \
  "aws iam get-role --role-name ${PREFIX}-ecs-task"

import_if_planned_create \
  'aws_iam_role_policy_attachment.ecs_execution[0]' \
  "${PREFIX}-ecs-execution/arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" \
  "aws iam get-role --role-name ${PREFIX}-ecs-execution"

import_if_planned_create \
  'aws_iam_role_policy.ecs_execution_secrets[0]' \
  "${PREFIX}-ecs-execution:${PREFIX}-ecs-execution-secrets" \
  "aws iam get-role-policy --role-name ${PREFIX}-ecs-execution --policy-name ${PREFIX}-ecs-execution-secrets"

import_if_planned_create \
  'aws_iam_role_policy.ecs_task[0]' \
  "${PREFIX}-ecs-task:${PREFIX}-ecs-task" \
  "aws iam get-role-policy --role-name ${PREFIX}-ecs-task --policy-name ${PREFIX}-ecs-task"

TG_ARN="$(aws elbv2 describe-target-groups --names "${PREFIX}-backend" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")"
if [ -z "$TG_ARN" ] || [ "$TG_ARN" = "None" ]; then
  TG_ARN="$(aws elbv2 describe-target-groups --query "TargetGroups[?TargetGroupName=='${PREFIX}-backend'].TargetGroupArn | [0]" --output text 2>/dev/null || echo "")"
fi
import_if_planned_create 'aws_lb_target_group.backend[0]' "$TG_ARN" "aws elbv2 describe-target-groups --names ${PREFIX}-backend"

ALB_ARN="$(aws elbv2 describe-load-balancers --query "LoadBalancers[?LoadBalancerName=='${PREFIX}-backend'].LoadBalancerArn | [0]" --output text 2>/dev/null || echo "")"
import_if_planned_create 'aws_lb.backend[0]' "$ALB_ARN" "aws elbv2 describe-load-balancers --query \"LoadBalancers[?LoadBalancerName=='${PREFIX}-backend']\""

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text 2>/dev/null || echo "")"
  import_if_planned_create 'aws_lb_listener.http[0]' "$LISTENER_ARN" "aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN"
fi

import_if_planned_create \
  'aws_ecs_cluster.backend[0]' \
  "${PREFIX}-backend" \
  "aws ecs describe-clusters --clusters ${PREFIX}-backend --query 'clusters[?status==\`ACTIVE\`].clusterName' --output text"

# aws_ecs_service.backend[0] — NUNCA importar (causa hangs y fallos MISSING). Apply lo crea.
echo "[import-plan-creates] ECS service: omitido (create vía apply si el plan lo indica)"

# Subnets por CIDR en VPC ancla
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for spec in \
    "aws_subnet.private_a|10.20.1.0/24" \
    "aws_subnet.private_b|10.20.2.0/24" \
    "aws_subnet.public_a[0]|10.20.10.0/24" \
    "aws_subnet.public_b[0]|10.20.11.0/24"; do
    addr="${spec%%|*}"
    cidr="${spec##*|}"
    subnet_id="$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" "Name=cidr-block,Values=${cidr}" --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
    import_if_planned_create "$addr" "$subnet_id" "aws ec2 describe-subnets --subnet-ids $subnet_id"
  done
fi

echo "[import-plan-creates] Completado"
