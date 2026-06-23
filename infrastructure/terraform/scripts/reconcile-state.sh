#!/usr/bin/env bash
# Quita taints, purga legacy App Runner y deposed del state sin destroy en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

echo "[reconcile-state] Estabilizando recursos de red y Redis..."

state_id() {
  terraform state show -json "$1" 2>/dev/null | jq -r '
    if (.values | type) == "array" then .values[0].id // empty
    else .values.id // empty
    end
  ' 2>/dev/null || true
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

  if jq '
    .resources |= [
      .[]
      | select((.type | test("^aws_apprunner")) | not)
      | select(.name != "apprunner_connector")
      | select((.name | test("apprunner")) | not)
      | .instances |= [
          .[]
          | select((has("deposed") and (.deposed | type) == "string")) | not)
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
      echo "  state rm $addr (aws id $target_id, sin destroy)"
      terraform state rm "$addr" || true
    fi
  done < <(terraform state list 2>/dev/null || true)
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
  'aws_ecs_cluster.backend[0]'
  'aws_ecs_service.backend[0]'
)

purge_legacy_from_state

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

prune_state_by_aws_id "sg-0dbb342ef24119cb9"

while IFS= read -r addr; do
  [ -z "$addr" ] && continue
  echo "  state rm $addr (legacy por nombre)"
  terraform state rm "$addr" || true
done < <(terraform state list 2>/dev/null | grep -iE 'apprunner|connector' || true)

echo "[reconcile-state] State actual:"
terraform state list 2>/dev/null | sort || true

echo "[reconcile-state] Completado"
