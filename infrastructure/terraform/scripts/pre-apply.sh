#!/usr/bin/env bash
# Pre-apply atómico: import → reconcile → plan → guard → apply (máx. 3 rondas).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infrastructure/terraform"
SCRIPTS="${ROOT}/infrastructure/terraform/scripts"
MAX_ROUNDS="${TF_PREAPPLY_MAX_ROUNDS:-3}"
PLAN_TIMEOUT="${TF_PLAN_TIMEOUT_SEC:-600}"

export TF_VAR_enable_ecs="${TF_VAR_enable_ecs:-false}"
export TF_VAR_enable_app_runner="${TF_VAR_enable_app_runner:-false}"

tf_plan() {
  timeout "$PLAN_TIMEOUT" terraform plan -input=false -no-color -out=pre-apply.plan -detailed-exitcode \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}"
}

sync_state() {
  cd "$ROOT"
  bash "$SCRIPTS/bootstrap-import.sh"
  bash "$SCRIPTS/reconcile-state.sh"
  cd "$TF_DIR"
}

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

checkpoint_state() {
  local state="${TF_DIR}/terraform.tfstate"
  if [ -f "$state" ]; then
    cp "$state" "${TF_DIR}/terraform.tfstate.pre-apply-round-${1}"
    echo "[pre-apply] Checkpoint state ronda ${1} (serial=$(jq -r '.serial' "$state"))"
  fi
}

cd "$TF_DIR"
sync_state
checkpoint_state "bootstrap"

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "[pre-apply] Ronda ${round}/${MAX_ROUNDS} (enable_ecs=${TF_VAR_enable_ecs})"

  if [ "$round" -gt 1 ]; then
    sync_state
    checkpoint_state "$round"
  fi

  set +e
  tf_plan
  ec=$?
  set -e

  if [ "$ec" -eq 124 ]; then
    echo "::error::terraform plan excedió ${PLAN_TIMEOUT}s"
    exit 1
  fi

  if [ "$ec" -eq 1 ]; then
    if [ "$round" -lt "$MAX_ROUNDS" ]; then
      echo "[pre-apply] Plan exit 1 — re-sync VPC/subnets e reintentar..."
      continue
    fi
    echo "::error::terraform plan falló tras ${MAX_ROUNDS} rondas"
    exit 1
  fi

  if plan_has_forbidden_deletes; then
    echo "[pre-apply] Deletes prohibidos — purgando legacy..."
    plan_delete_addresses | while read -r addr; do
      [ -z "$addr" ] && continue
      case "$addr" in
        *apprunner*|*connector*)
          terraform state rm "$addr" || true
          ;;
      esac
    done
    continue
  fi

  if plan_has_drift_creates || plan_modifies_redis_cluster || plan_has_subnet_replace; then
    echo "[pre-apply] Drift detectado — re-import en siguiente ronda..."
    continue
  fi

  bash "$SCRIPTS/guard-network-plan.sh" pre-apply.plan

  echo "[pre-apply] Apply (sin plan congelado)..."
  terraform apply -input=false -auto-approve -parallelism=10 \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}"
  exit 0
done

echo "::error::Drift no resuelto tras ${MAX_ROUNDS} rondas"
terraform show -no-color pre-apply.plan 2>/dev/null | head -80 || true
exit 1
