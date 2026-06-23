#!/usr/bin/env bash
# Quita taints, limpia deposed, retira legacy App Runner del state sin destroy en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

echo "[reconcile-state] Estabilizando recursos de red y Redis..."

state_id() {
  terraform state show -no-color "$1" 2>/dev/null | awk '/^[[:space:]]*id[[:space:]]*=/ { print $3; exit }' | tr -d '"'
}

strip_deposed_objects() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "[reconcile-state] jq no disponible — omitiendo limpieza de deposed"
    return 0
  fi

  local tmp pulled
  tmp="$(mktemp)"
  pulled="$(mktemp)"

  if ! terraform state pull >"$pulled" 2>/dev/null; then
    rm -f "$tmp" "$pulled"
    return 0
  fi

  if jq -e '
    .resources |= map(
      .instances |= (
        [.[] | select(has("deposed") | not) | del(.deposed_key)]
      )
    )
  ' "$pulled" >"$tmp"; then
    if ! cmp -s "$pulled" "$tmp"; then
      echo "[reconcile-state] Eliminando instancias deposed del state"
      terraform state push -force "$tmp"
    fi
  fi

  rm -f "$tmp" "$pulled"
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

strip_deposed_objects

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
  aws_iam_role.apprunner_ecr_access
  aws_iam_role.apprunner_instance
  'aws_iam_role_policy.apprunner_instance'
)

for addr in "${LEGACY[@]}"; do
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    echo "  state rm $addr (legacy App Runner, sin destroy)"
    terraform state rm "$addr" || true
  fi
done

# SG/subnet huérfanos conocidos de applies fallidos (App Runner / replace)
prune_state_by_aws_id "sg-0dbb342ef24119cb9"

while IFS= read -r addr; do
  [ -z "$addr" ] && continue
  echo "  state rm $addr (legacy por nombre)"
  terraform state rm "$addr" || true
done < <(terraform state list 2>/dev/null | grep -iE 'apprunner|connector' || true)

echo "[reconcile-state] Completado"
