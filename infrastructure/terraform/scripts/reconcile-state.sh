#!/usr/bin/env bash
# Quita taints, purga legacy App Runner y deposed del state sin destroy en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

KNOWN_ORPHAN_SG="sg-0dbb342ef24119cb9"
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

prune_state_by_aws_id "$KNOWN_ORPHAN_SG"

while IFS= read -r addr; do
  [ -z "$addr" ] && continue
  echo "  state rm $addr (legacy por nombre)"
  terraform state rm "$addr" || true
done < <(terraform state list 2>/dev/null | grep -iE 'apprunner|connector' || true)

echo "[reconcile-state] State actual:"
terraform state list 2>/dev/null | sort || true

echo "[reconcile-state] Completado"
