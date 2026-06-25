#!/usr/bin/env bash
# Quita taints, purga legacy App Runner y deposed del state sin destroy en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"

# shellcheck source=aws-probe.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aws-probe.sh"
# shellcheck source=vpc-anchor-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vpc-anchor-lib.sh"

KNOWN_ORPHAN_SG="sg-0dbb342ef24119cb9"
KNOWN_ORPHAN_ALB_SG="sg-04402f38fc4401001"
KNOWN_PRIVATE_SUBNET="subnet-0f19bd9d7914446de"

echo "[reconcile-state] Estabilizando recursos de red y Redis..."

state_id() {
  local addr="$1"
  local id

  id="$(terraform state show -no-color "$addr" 2>/dev/null | awk '/^[[:space:]]*id[[:space:]]*=/ { print $3; exit }' | tr -d '"')"
  if [ -n "$id" ]; then
    echo "$id"
    return 0
  fi

  if command -v jq >/dev/null 2>&1; then
    terraform state show -json "$addr" 2>/dev/null | jq -r '
      .values.id // .values.root_module.resources[0].values.id // empty
    ' 2>/dev/null || true
  fi
}

purge_legacy_from_state() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "[reconcile-state] jq no disponible — omitiendo purga JSON del state"
    return 0
  fi

  local pulled tmp
  pulled="$(mktemp)"
  tmp="$(mktemp)"

  if ! terraform state pull >"$pulled" 2>/dev/null; then
    rm -f "$pulled" "$tmp"
    return 0
  fi

  if jq --arg orphan_sg "$KNOWN_ORPHAN_SG" '
    .resources |= [
      .[]
      | select((.type | test("^aws_apprunner")) | not)
      | select(.name != "apprunner_connector")
      | select((.name | test("apprunner")) | not)
      | select(
          ([.instances[]?.attributes?.id?] | index($orphan_sg)) | not
        )
      | .instances |= [
          .[]
          | select(has("deposed") | not)
          | del(.deposed_key)
        ]
    ]
    | .resources |= map(select(.instances | length > 0))
  ' "$pulled" >"$tmp"; then
    if ! cmp -s "$pulled" "$tmp"; then
      echo "[reconcile-state] Purga legacy App Runner / deposed (state push)"
      terraform state push -force "$tmp"
    fi
  fi

  rm -f "$pulled" "$tmp"
}

prune_state_by_aws_id() {
  local target_id="$1"
  local addr sid

  [ -z "$target_id" ] && return 0

  while IFS= read -r addr; do
    [ -z "$addr" ] && continue
    sid="$(state_id "$addr")"
    if [ "$sid" = "$target_id" ]; then
      if [ "$target_id" = "$KNOWN_PRIVATE_SUBNET" ] && [ "$addr" = "aws_subnet.private_a" ]; then
        echo "  conservar $addr ($target_id) — subnet privada activa"
        terraform untaint "$addr" 2>/dev/null || true
        continue
      fi
      echo "  state rm $addr (aws id $target_id, sin destroy)"
      terraform state rm "$addr" || true
    fi
  done < <(terraform state list 2>/dev/null || true)
}

purge_sg_rules_for_compute() {
  local rule_addr
  for rule_addr in \
    'aws_security_group_rule.ecs_tasks_from_alb[0]' \
    'aws_security_group_rule.redis_from_ecs[0]'; do
    if terraform state show -no-color "$rule_addr" >/dev/null 2>&1; then
      echo "  state rm $rule_addr (recrear tras alinear SGs)"
      terraform state rm "$rule_addr" || true
    fi
  done
}

purge_compute_sgs_not_in_anchor() {
  local anchor="$1"
  local addr sg vpc purged=0

  [ -z "$anchor" ] || [ "$anchor" = "None" ] && return 0

  for addr in 'aws_security_group.alb[0]' 'aws_security_group.ecs_tasks[0]' 'aws_security_group.redis'; do
    if ! terraform state show -no-color "$addr" >/dev/null 2>&1; then
      continue
    fi
    sg="$(state_id "$addr")"
    vpc="$(sg_live_vpc_id "$sg")"
    if [ -n "$sg" ] && [ -n "$vpc" ] && [ "$vpc" != "None" ] && [ "$vpc" != "$anchor" ]; then
      echo "[reconcile-state] $addr ($sg) en VPC $vpc != ancla $anchor — state rm"
      terraform state rm "$addr" || true
      purged=1
    fi
  done

  if [ "$purged" -eq 1 ]; then
    purge_sg_rules_for_compute
  fi
}

STABLE=(
  aws_vpc.main
  aws_subnet.private_a
  aws_subnet.private_b
  aws_security_group.redis
  aws_elasticache_subnet_group.redis
  aws_elasticache_cluster.redis
  'aws_subnet.public_a[0]'
  'aws_subnet.public_b[0]'
  'aws_internet_gateway.main[0]'
  'aws_nat_gateway.main[0]'
  'aws_eip.nat[0]'
  'aws_security_group.alb[0]'
  'aws_security_group.ecs_tasks[0]'
  'aws_lb.backend[0]'
  'aws_lb_target_group.backend[0]'
  'aws_lb_listener.http[0]'
  'aws_iam_role.ecs_execution[0]'
  'aws_iam_role.ecs_task[0]'
  'aws_iam_role_policy_attachment.ecs_execution[0]'
  'aws_iam_role_policy.ecs_execution_secrets[0]'
  'aws_iam_role_policy.ecs_task[0]'
  'aws_ecs_cluster.backend[0]'
)

purge_legacy_from_state

purge_ephemeral_ecs_state "$PREFIX"

for addr in "${STABLE[@]}"; do
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    terraform untaint "$addr" 2>/dev/null && echo "  untaint $addr" || true
  fi
done

LEGACY=(
  aws_security_group.apprunner_connector
  'aws_apprunner_vpc_connector.main[0]'
  'aws_apprunner_vpc_connector.main'
  'aws_apprunner_service.backend[0]'
  'aws_apprunner_auto_scaling_configuration_version.backend[0]'
  'aws_cloudwatch_log_group.apprunner[0]'
  'aws_cloudwatch_metric_alarm.apprunner_5xx[0]'
  'aws_cloudwatch_metric_alarm.apprunner_latency[0]'
  aws_iam_role.apprunner_ecr_access
  aws_iam_role.apprunner_instance
  'aws_iam_role_policy.apprunner_instance'
  'aws_iam_role_policy_attachment.apprunner_ecr_access'
)

for addr in "${LEGACY[@]}"; do
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    echo "  state rm $addr (legacy App Runner, sin destroy)"
    terraform state rm "$addr" || true
  fi
done

prune_state_by_aws_id "$KNOWN_ORPHAN_SG"
prune_state_by_aws_id "$KNOWN_ORPHAN_ALB_SG"

ANCHOR_VPC="$(discover_anchor_vpc_id "$PREFIX")"
if [ -n "$ANCHOR_VPC" ] && [ "$ANCHOR_VPC" != "None" ]; then
  echo "[reconcile-state] VPC ancla: $ANCHOR_VPC"
  purge_compute_sgs_not_in_anchor "$ANCHOR_VPC"
else
  echo "[reconcile-state] Sin VPC ancla — omitiendo purga SG compute"
fi

while IFS= read -r addr; do
  [ -z "$addr" ] && continue
  echo "  state rm $addr (legacy por nombre)"
  terraform state rm "$addr" || true
done < <(terraform state list 2>/dev/null | grep -iE 'apprunner|connector' || true)

echo "[reconcile-state] State actual:"
terraform state list 2>/dev/null | sort || true

echo "[reconcile-state] Completado"
