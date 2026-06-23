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
AWS_REGION="${TF_VAR_aws_region:-sa-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
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

state_resource_id() {
  terraform state show -no-color "$1" 2>/dev/null | awk '/^[[:space:]]*id[[:space:]]*=/ { print $3; exit }' | tr -d '"'
}

# Alinea state con el ID real en AWS (re-import si el state apunta a otro recurso).
reconcile_resource_id() {
  local addr="$1"
  local aws_id="$2"
  local probe="${3:-}"

  [ -z "$aws_id" ] || [ "$aws_id" = "None" ] && return 0

  if [ -n "$probe" ]; then
    if ! bash -c "$probe" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if in_state "$addr"; then
    local state_id
    state_id="$(state_resource_id "$addr")"
    if [ "$state_id" = "$aws_id" ]; then
      echo "[bootstrap-import] OK (id coincide): $addr=$aws_id"
      return 0
    fi
    echo "[bootstrap-import] Reconciliando $addr: state=${state_id:-?} -> aws=$aws_id"
    terraform state rm "$addr" 2>/dev/null || true
  fi

  echo "[bootstrap-import] Importando $addr <- $aws_id"
  if terraform import -input=false "$addr" "$aws_id"; then
    echo "[bootstrap-import] OK: $addr"
    return 0
  fi

  echo "::warning::No se pudo importar $addr (id=$aws_id)"
  IMPORT_ERRORS=$((IMPORT_ERRORS + 1))
  return 0
}

discover_subnet_in_vpc() {
  local cidr="$1"
  local name_tag="$2"
  local subnet_id

  subnet_id="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=cidr-block,Values=${cidr}" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"

  if [ -z "$subnet_id" ] || [ "$subnet_id" = "None" ]; then
    subnet_id="$(aws ec2 describe-subnets \
      --filters "Name=tag:Name,Values=${name_tag}" \
      --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  fi

  echo "$subnet_id"
}

discover_sg_in_vpc() {
  local group_name="$1"
  local sg_id

  sg_id="$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${group_name}" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"

  if [ -z "$sg_id" ] || [ "$sg_id" = "None" ]; then
    sg_id="$(aws ec2 describe-security-groups \
      --filters "Name=group-name,Values=${group_name}" \
      --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")"
  fi

  echo "$sg_id"
}

import_compute_network() {
  local pub_a pub_b igw eip nat rt_pub rt_priv

  echo "[bootstrap-import] Red pública ECS (VPC=${VPC_ID})..."

  pub_a="$(discover_subnet_in_vpc "10.20.10.0/24" "${PREFIX}-public-a")"
  reconcile_resource_id 'aws_subnet.public_a[0]' "$pub_a"

  pub_b="$(discover_subnet_in_vpc "10.20.11.0/24" "${PREFIX}-public-b")"
  reconcile_resource_id 'aws_subnet.public_b[0]' "$pub_b"

  igw="$(aws ec2 describe-internet-gateways \
    --filters "Name=attachment.vpc-id,Values=${VPC_ID}" \
    --query 'InternetGateways[0].InternetGatewayId' --output text 2>/dev/null || echo "")"
  reconcile_resource_id 'aws_internet_gateway.main[0]' "$igw"

  eip="$(aws ec2 describe-addresses \
    --filters "Name=tag:Name,Values=${PREFIX}-nat-eip" \
    --query 'Addresses[0].AllocationId' --output text 2>/dev/null || echo "")"
  reconcile_resource_id 'aws_eip.nat[0]' "$eip"

  nat="$(aws ec2 describe-nat-gateways \
    --filter "Name=tag:Name,Values=${PREFIX}-nat" "Name=state,Values=available" \
    --query 'NatGateways[0].NatGatewayId' --output text 2>/dev/null || echo "")"
  if [ -z "$nat" ] || [ "$nat" = "None" ]; then
    nat="$(aws ec2 describe-nat-gateways \
      --filter "Name=vpc-id,Values=${VPC_ID}" "Name=state,Values=available" \
      --query 'NatGateways[0].NatGatewayId' --output text 2>/dev/null || echo "")"
  fi
  reconcile_resource_id 'aws_nat_gateway.main[0]' "$nat"

  rt_pub="$(aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=${PREFIX}-public-rt" \
    --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo "")"
  reconcile_resource_id 'aws_route_table.public[0]' "$rt_pub"

  rt_priv="$(aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=${PREFIX}-private-rt" \
    --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo "")"
  reconcile_resource_id 'aws_route_table.private[0]' "$rt_priv"

  if [ -n "$pub_a" ] && [ "$pub_a" != "None" ] && [ -n "$rt_pub" ] && [ "$rt_pub" != "None" ]; then
    reconcile_resource_id 'aws_route_table_association.public_a[0]' "${pub_a}/${rt_pub}"
  fi

  if [ -n "$pub_b" ] && [ "$pub_b" != "None" ] && [ -n "$rt_pub" ] && [ "$rt_pub" != "None" ]; then
    reconcile_resource_id 'aws_route_table_association.public_b[0]' "${pub_b}/${rt_pub}"
  fi

  if [ -n "$SUBNET_A" ] && [ "$SUBNET_A" != "None" ] && [ -n "$rt_priv" ] && [ "$rt_priv" != "None" ]; then
    reconcile_resource_id 'aws_route_table_association.private_a[0]' "${SUBNET_A}/${rt_priv}"
  fi

  if [ -n "$SUBNET_B" ] && [ "$SUBNET_B" != "None" ] && [ -n "$rt_priv" ] && [ "$rt_priv" != "None" ]; then
    reconcile_resource_id 'aws_route_table_association.private_b[0]' "${SUBNET_B}/${rt_priv}"
  fi
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
  "aws s3api head-bucket --bucket ${PREFIX}-media-${ACCOUNT_ID} --region sa-east-1"

# --- ElastiCache ---
import_when_needed \
  'aws_elasticache_subnet_group.redis' \
  "${PREFIX}-redis" \
  "aws elasticache describe-cache-subnet-groups --cache-subnet-group-name ${PREFIX}-redis"

import_when_needed \
  'aws_elasticache_cluster.redis' \
  "${PREFIX}-redis" \
  "aws elasticache describe-cache-clusters --cache-cluster-id ${PREFIX}-redis"

discover_vpc_id() {
  local subnet_id vpc_id

  subnet_id="$(aws ec2 describe-subnets \
    --filters "Name=cidr-block,Values=10.20.1.0/24" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"

  if [ -n "$subnet_id" ] && [ "$subnet_id" != "None" ]; then
    vpc_id="$(aws ec2 describe-subnets --subnet-ids "$subnet_id" \
      --query 'Subnets[0].VpcId' --output text 2>/dev/null || echo "")"
    if [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ]; then
      echo "$vpc_id"
      return 0
    fi
  fi

  vpc_id="$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=${PREFIX}-vpc" \
    --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")"

  if [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ]; then
    vpc_id="$(aws ec2 describe-vpcs \
      --filters "Name=cidr-block,Values=10.20.0.0/16" \
      --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")"
  fi

  echo "$vpc_id"
}

# --- VPC / networking (VPC = la que contiene las subnets reales por CIDR) ---
VPC_ID="$(discover_vpc_id)"

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  reconcile_resource_id 'aws_vpc.main' "$VPC_ID"

  SUBNET_A="$(discover_subnet_in_vpc "10.20.1.0/24" "${PREFIX}-private-a")"
  if [ -z "$SUBNET_A" ] || [ "$SUBNET_A" = "None" ]; then
    if aws ec2 describe-subnets --subnet-ids subnet-0f19bd9d7914446de >/dev/null 2>&1; then
      SUBNET_A="subnet-0f19bd9d7914446de"
      echo "[bootstrap-import] Subnet A por ID conocido: $SUBNET_A"
    fi
  fi
  reconcile_resource_id 'aws_subnet.private_a' "$SUBNET_A"

  SUBNET_B="$(discover_subnet_in_vpc "10.20.2.0/24" "${PREFIX}-private-b")"
  reconcile_resource_id 'aws_subnet.private_b' "$SUBNET_B"

  SG_CONN="$(discover_sg_in_vpc "${PREFIX}-ecs")"
  reconcile_resource_id 'aws_security_group.ecs_tasks[0]' "$SG_CONN"

  SG_ALB="$(discover_sg_in_vpc "${PREFIX}-alb")"
  reconcile_resource_id 'aws_security_group.alb[0]' "$SG_ALB"

  SG_REDIS="$(discover_sg_in_vpc "${PREFIX}-redis")"
  reconcile_resource_id 'aws_security_group.redis' "$SG_REDIS"

  if [ "${TF_VAR_enable_ecs:-false}" = "true" ] || [ "${TF_VAR_enable_app_runner:-false}" = "true" ]; then
    import_compute_network
  fi
fi

# --- ECS Fargate (solo si enable_ecs o enable_app_runner legacy) ---
if [ "${TF_VAR_enable_ecs:-false}" = "true" ] || [ "${TF_VAR_enable_app_runner:-false}" = "true" ]; then
  import_when_needed \
    'aws_ecs_cluster.backend[0]' \
    "${PREFIX}-backend" \
    "aws ecs describe-clusters --clusters ${PREFIX}-backend --query 'clusters[?status==\`ACTIVE\`].clusterName' --output text"

  import_when_needed \
    'aws_cloudwatch_log_group.ecs[0]' \
    "/ecs/${PREFIX}-backend" \
    "aws logs describe-log-groups --log-group-name-prefix /ecs/${PREFIX}-backend"

  ALB_ARN="$(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?LoadBalancerName=='${PREFIX}-backend'].LoadBalancerArn | [0]" \
    --output text 2>/dev/null || echo "")"
  if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    import_when_needed 'aws_lb.backend[0]' "$ALB_ARN"
  fi
fi

echo "[bootstrap-import] Completado (import warnings: ${IMPORT_ERRORS})"
