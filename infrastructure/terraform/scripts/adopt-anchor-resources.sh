#!/usr/bin/env bash
# Adopta recursos que ya existen en la VPC ancla pero faltan en el state (evita InvalidGroup.Duplicate).
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"
AWS_REGION="${TF_VAR_aws_region:-sa-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"

# shellcheck source=aws-probe.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aws-probe.sh"
# shellcheck source=import-shared.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/import-shared.sh"
# shellcheck source=terraform-import-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/terraform-import-lib.sh"
# shellcheck source=vpc-anchor-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vpc-anchor-lib.sh"

in_state() {
  terraform state show -no-color "$1" >/dev/null 2>&1
}

state_resource_id() {
  terraform state show -no-color "$1" 2>/dev/null | awk '/^[[:space:]]*id[[:space:]]*=/ { print $3; exit }' | tr -d '"'
}

import_if_missing() {
  local addr="$1"
  local aws_id="$2"
  local probe="${3:-}"

  [ -z "$aws_id" ] || [ "$aws_id" = "None" ] && return 0
  in_state "$addr" && return 0

  if [ -n "$probe" ] && ! aws_probe_ok "$probe"; then
    return 0
  fi

  echo "[adopt-anchor] $addr <- $aws_id"
  run_terraform_import "$addr" "$aws_id" || echo "::warning::adopt-anchor: import falló $addr"
}

purge_route_table_if_wrong_vpc() {
  local addr='aws_route_table.private[0]'
  local rtb_id live_vpc

  in_state "$addr" || return 0
  rtb_id="$(state_resource_id "$addr")"
  live_vpc="$(route_table_vpc_id "$rtb_id")"
  if [ -n "$live_vpc" ] && [ "$live_vpc" != "None" ] && [ -n "${VPC_ID:-}" ] && [ "$live_vpc" != "$VPC_ID" ]; then
    echo "[adopt-anchor] $addr ($rtb_id) en VPC $live_vpc != ancla $VPC_ID — state rm"
    terraform state rm "$addr" 2>/dev/null || true
  fi
}

purge_managed_sg_if_live_in_aws() {
  local addr="$1"
  local live_sg="$2"
  local state_addr candidates=()

  if [[ "$addr" == *'['* ]]; then
    candidates=("$addr" "${addr%%\[*}")
  else
    candidates=("$addr" "${addr}[0]")
  fi

  if ! aws_value_ok "$live_sg"; then
    if [[ "$addr" == *'['* ]]; then
      import_if_missing "$addr" "$live_sg" "aws ec2 describe-security-groups --group-ids $live_sg"
    else
      import_if_missing "${addr}[0]" "$live_sg" "aws ec2 describe-security-groups --group-ids $live_sg"
    fi
    return 0
  fi

  for state_addr in "${candidates[@]}"; do
    if in_state "$state_addr"; then
      echo "[adopt-anchor] $state_addr existe en AWS ($live_sg) — state rm (data source, count=0)"
      terraform state rm "$state_addr" 2>/dev/null || true
    fi
  done
}

ensure_ecs_sg_egress() {
  local ecs_sg="$1"
  local egress_count

  [ -z "$ecs_sg" ] || [ "$ecs_sg" = "None" ] && return 0

  egress_count="$(aws ec2 describe-security-groups --group-ids "$ecs_sg" \
    --query 'length(SecurityGroups[0].IpPermissionsEgress)' --output text 2>/dev/null || echo "0")"

  if [ "$egress_count" = "0" ] || [ "$egress_count" = "None" ]; then
    echo "[adopt-anchor] SG ECS $ecs_sg sin egress — añadiendo 0.0.0.0/0"
    if aws ec2 authorize-security-group-egress \
      --group-id "$ecs_sg" \
      --ip-permissions "IpProtocol=-1,FromPort=0,ToPort=0,IpRanges=[{CidrIp=0.0.0.0/0,Description='All outbound'}]" 2>/dev/null; then
      echo "[adopt-anchor] OK: egress añadido a $ecs_sg"
    else
      echo "::warning::No se pudo añadir egress a $ecs_sg (puede existir ya)"
    fi
  fi
}

purge_deprecated_sg_rules() {
  local rule_addr
  for rule_addr in \
    'aws_security_group_rule.ecs_tasks_from_alb[0]' \
    'aws_security_group_rule.redis_from_ecs[0]'; do
    if in_state "$rule_addr"; then
      echo "[adopt-anchor] state rm $rule_addr (reglas inline en SG)"
      terraform state rm "$rule_addr" 2>/dev/null || true
    fi
  done
}

VPC_ID="$(discover_anchor_vpc_id "$PREFIX")"
echo "[adopt-anchor] VPC ancla: ${VPC_ID:-?}"
[ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ] || exit 0

purge_deprecated_sg_rules

SG_REDIS="$(sg_by_name_in_vpc "$VPC_ID" "${PREFIX}-redis")"
purge_managed_sg_if_live_in_aws 'aws_security_group.redis' "$SG_REDIS"

[ "${TF_VAR_enable_ecs:-false}" = "true" ] || {
  echo "[adopt-anchor] enable_ecs=false — omitiendo ALB/ECS/endpoints"
  echo "[adopt-anchor] Completado"
  exit 0
}

purge_route_table_if_wrong_vpc

SG_ALB="$(sg_by_name_in_vpc "$VPC_ID" "${PREFIX}-alb")"
SG_ECS="$(sg_by_name_in_vpc "$VPC_ID" "${PREFIX}-ecs")"
SG_VPCE="$(sg_by_name_in_vpc "$VPC_ID" "${PREFIX}-vpc-endpoints")"

ensure_ecs_sg_egress "$SG_ECS"

SGR_ECS_EGRESS="$(discover_sg_egress_all_rule "$SG_ECS")"
if aws_value_ok "$SGR_ECS_EGRESS"; then
  import_if_missing \
    'aws_security_group_rule.ecs_tasks_egress_all[0]' \
    "$SGR_ECS_EGRESS" \
    "aws ec2 describe-security-group-rules --security-group-rule-ids ${SGR_ECS_EGRESS}"
fi

purge_managed_sg_if_live_in_aws 'aws_security_group.alb[0]' "$SG_ALB"
purge_managed_sg_if_live_in_aws 'aws_security_group.ecs_tasks[0]' "$SG_ECS"
purge_managed_sg_if_live_in_aws 'aws_security_group.vpc_endpoints[0]' "$SG_VPCE"

RT_PRIV="$(discover_private_route_table_in_vpc "$VPC_ID" "$PREFIX")"
import_if_missing 'aws_route_table.private[0]' "$RT_PRIV" "aws ec2 describe-route-tables --route-table-ids $RT_PRIV"

for svc in secretsmanager ecr.api ecr.dkr logs; do
  svc_name="com.amazonaws.${AWS_REGION}.${svc}"
  ep_id="$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=service-name,Values=${svc_name}" \
    --query 'VpcEndpoints[?State!=`deleted`].VpcEndpointId | [0]' --output text 2>/dev/null || echo "")"
  import_if_missing \
    "aws_vpc_endpoint.interface[\"${svc}\"]" \
    "$ep_id" \
    "aws ec2 describe-vpc-endpoints --vpc-endpoint-ids $ep_id"
done

s3_ep="$(aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=${VPC_ID}" "Name=service-name,Values=com.amazonaws.${AWS_REGION}.s3" \
  --query 'VpcEndpoints[?VpcEndpointType==`Gateway` && State!=`deleted`].VpcEndpointId | [0]' --output text 2>/dev/null || echo "")"
import_if_missing 'aws_vpc_endpoint.s3[0]' "$s3_ep" "aws ec2 describe-vpc-endpoints --vpc-endpoint-ids $s3_ep"

echo "[adopt-anchor] Completado"
