#!/usr/bin/env bash
# Pre-apply atómico con reintentos: import → reconcile → plan → guard → apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infrastructure/terraform"
SCRIPTS="${ROOT}/infrastructure/terraform/scripts"
MAX_ROUNDS=5

export TF_VAR_enable_ecs="${TF_VAR_enable_ecs:-false}"
export TF_VAR_enable_app_runner="${TF_VAR_enable_app_runner:-false}"

plan_delete_addresses() {
  terraform show -json pre-apply.plan | jq -r '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "delete" or . == "destroy"))
      | .address
    ] | unique | .[]
  ' 2>/dev/null || true
}

plan_has_forbidden_deletes() {
  terraform show -json pre-apply.plan | jq -e '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "delete" or . == "destroy"))
      | select(.address | test("apprunner|connector|aws_subnet\\.private_[ab]|aws_vpc\\.main"))
    ] | length > 0
  ' >/dev/null 2>&1
}

plan_has_drift_creates() {
  terraform show -json pre-apply.plan | jq -e '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "create"))
      | select(.address | test(
          "aws_iam_role\\.ecs_|aws_lb_target_group\\.backend|aws_security_group\\.redis|aws_vpc\\.main"
        ))
    ] | length > 0
  ' >/dev/null 2>&1
}

plan_has_subnet_replace() {
  terraform show -json pre-apply.plan 2>/dev/null | jq -e '
    [.resource_changes[]
      | select(
          ([.change.actions[]] | any(. == "delete" or . == "destroy"))
          and ([.change.actions[]] | any(. == "create"))
        )
      | select(.address | test("aws_subnet\\."))
    ] | length > 0
  ' >/dev/null 2>&1
}

plan_modifies_redis_cluster() {
  terraform show -json pre-apply.plan | jq -e '
    [.resource_changes[]
      | select(.address == "aws_elasticache_cluster.redis")
      | select([.change.actions[]] | any(. == "update"))
      | select(.change.after.security_group_ids != .change.before.security_group_ids)
    ] | length > 0
  ' >/dev/null 2>&1
}

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "[pre-apply] Ronda ${round}/${MAX_ROUNDS} (enable_ecs=${TF_VAR_enable_ecs})"

  cd "$ROOT"
  bash "$SCRIPTS/bootstrap-import.sh"
  bash "$SCRIPTS/reconcile-state.sh"

  cd "$TF_DIR"

  set +e
  terraform plan -input=false -no-color -out=pre-apply.plan -detailed-exitcode \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}"
  ec=$?
  set -e

  if [ "$ec" -eq 1 ]; then
    if [ "$round" -lt "$MAX_ROUNDS" ]; then
      echo "[pre-apply] Plan exit 1 (¿VPC/subnet replace?) — re-sync e reintentar..."
      continue
    fi
    echo "::error::terraform plan falló tras ${MAX_ROUNDS} rondas"
    exit 1
  fi

  if plan_has_forbidden_deletes; then
    echo "[pre-apply] Deletes prohibidos en plan — purgando legacy del state..."
    plan_delete_addresses | while read -r addr; do
      [ -z "$addr" ] && continue
      case "$addr" in
        *apprunner*|*connector*)
          echo "  state rm $addr"
          terraform state rm "$addr" || true
          ;;
        aws_subnet.private_a|aws_subnet.private_b|aws_vpc.main)
          echo "[pre-apply] Re-import red core tras delete en plan: $addr"
          ;;
      esac
    done
    continue
  fi

  if plan_has_drift_creates || plan_modifies_redis_cluster || plan_has_subnet_replace; then
    echo "[pre-apply] Drift detectado (create/replace red o ECS) — re-import en siguiente ronda..."
    terraform show -no-color pre-apply.plan | grep -E 'create|aws_iam_role\.ecs|aws_lb_target_group|aws_elasticache_cluster\.redis|aws_security_group\.redis|aws_vpc\.main' || true
    continue
  fi

  bash "$SCRIPTS/guard-network-plan.sh" pre-apply.plan

  echo "[pre-apply] Apply (state reconciliado, sin plan congelado)..."
  terraform apply -input=false -auto-approve \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}"
  exit 0
done

echo "::error::Drift no resuelto tras ${MAX_ROUNDS} rondas"
terraform show -no-color pre-apply.plan | head -80 || true
exit 1
