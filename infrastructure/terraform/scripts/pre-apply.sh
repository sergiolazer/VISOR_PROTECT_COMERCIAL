#!/usr/bin/env bash
# Pre-apply: sync → plan → import creates → plan → guard → apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infrastructure/terraform"
SCRIPTS="${ROOT}/infrastructure/terraform/scripts"
PLAN_TIMEOUT="${TF_PLAN_TIMEOUT_SEC:-600}"

export TF_VAR_enable_ecs="${TF_VAR_enable_ecs:-false}"
export TF_VAR_enable_app_runner="${TF_VAR_enable_app_runner:-false}"

tf_plan() {
  timeout "$PLAN_TIMEOUT" terraform plan -input=false -no-color -out=pre-apply.plan -detailed-exitcode \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}" \
    -var="github_org=${TF_VAR_github_org:?TF_VAR_github_org requerido}" \
    -var="cors_origin=${TF_VAR_cors_origin:?TF_VAR_cors_origin requerido}" \
    -var="aws_region=${TF_VAR_aws_region:-sa-east-1}"
}

tf_plan_diagnose() {
  echo "[pre-apply] Diagnóstico terraform plan:"
  terraform plan -input=false -no-color \
    -var="enable_ecs=${TF_VAR_enable_ecs}" \
    -var="enable_app_runner=${TF_VAR_enable_app_runner}" \
    -var="github_org=${TF_VAR_github_org:?}" \
    -var="cors_origin=${TF_VAR_cors_origin:?}" \
    -var="aws_region=${TF_VAR_aws_region:-sa-east-1}" 2>&1 | tail -80 || true
}

tf_apply() {
  if [ ! -f pre-apply.plan ]; then
    echo "::error::pre-apply.plan no encontrado — no se puede aplicar"
    exit 1
  fi
  # Aplicar exactamente el plan validado por guard-network-plan (evita creates/deletes sorpresa).
  terraform apply -input=false -auto-approve -parallelism=10 pre-apply.plan
}

sync_state() {
  cd "$ROOT"
  bash "$SCRIPTS/bootstrap-import.sh"
  bash "$SCRIPTS/reconcile-state.sh"
  cd "$TF_DIR"
}

log_plan_summary() {
  echo "[pre-apply] Resumen del plan:"
  terraform show -json pre-apply.plan | jq -r '
    [.resource_changes[]
      | {address, actions: .change.actions}
    ] | .[] | "\(.address): \(.actions | join(","))"'
  2>/dev/null || terraform show -no-color pre-apply.plan | grep -E '^(  # |  [~+-])' | head -40 || true
}

plan_has_forbidden_deletes() {
  terraform show -json pre-apply.plan | jq -e '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "delete" or . == "destroy"))
      | select(.address | test("apprunner|connector|aws_subnet\\.private_[ab]|aws_vpc\\.main"))
    ] | length > 0
  ' >/dev/null 2>&1
}

plan_has_compute_deletes() {
  terraform show -json pre-apply.plan 2>/dev/null | jq -e '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "delete" or . == "destroy"))
      | select([.change.actions[]] | any(. == "create") | not)
      | select(.address | test("aws_security_group\\.(alb|ecs_tasks)|aws_lb\\.|aws_lb_target_group|aws_lb_listener"))
    ] | length > 0
  ' >/dev/null 2>&1
}

plan_has_compute_replace() {
  terraform show -json pre-apply.plan 2>/dev/null | jq -e '
    [.resource_changes[]
      | select(
          ([.change.actions[]] | any(. == "delete" or . == "destroy"))
          and ([.change.actions[]] | any(. == "create"))
        )
      | select(.address | test("aws_security_group\\.(alb|ecs_tasks|redis)|aws_lb_target_group"))
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

cd "$TF_DIR"
echo "[pre-apply] enable_ecs=${TF_VAR_enable_ecs}"
sync_state

set +e
tf_plan
ec=$?
set -e

if [ "$ec" -eq 124 ]; then
  echo "::error::terraform plan excedió ${PLAN_TIMEOUT}s"
  exit 1
fi

if [ "$ec" -eq 1 ]; then
  echo "::error::terraform plan falló (exit 1)"
  tf_plan_diagnose
  log_plan_summary
  exit 1
fi

if plan_has_forbidden_deletes; then
  echo "[pre-apply] Deletes prohibidos — purgando legacy App Runner del state..."
  terraform state list 2>/dev/null | grep -iE 'apprunner|connector' | while read -r addr; do
    [ -z "$addr" ] && continue
    terraform state rm "$addr" || true
  done
  sync_state
  set +e
  tf_plan
  ec=$?
  set -e
  [ "$ec" -eq 1 ] && exit 1
fi

if plan_has_subnet_replace; then
  echo "[pre-apply] Replace de subnets detectado — re-sync VPC ancla..."
  sync_state
  set +e
  tf_plan
  ec=$?
  set -e
  if plan_has_subnet_replace; then
    echo "::error::El plan sigue queriendo reemplazar subnets (conflicto VPC)."
    log_plan_summary
    exit 1
  fi
fi

echo "[pre-apply] Importando creates existentes en AWS..."
bash "$SCRIPTS/import-plan-creates.sh" pre-apply.plan
bash "$SCRIPTS/reconcile-state.sh"

for round in 1 2; do
  set +e
  tf_plan
  ec=$?
  set -e

  if [ "$ec" -eq 1 ]; then
    echo "::error::terraform plan falló tras import-plan-creates (ronda $round)"
    tf_plan_diagnose
    log_plan_summary
    exit 1
  fi

  if plan_has_compute_deletes; then
    echo "[pre-apply] Deletes en ALB/ECS detectados — re-sync state (ronda $round)..."
    sync_state
    bash "$SCRIPTS/import-plan-creates.sh" pre-apply.plan
    continue
  fi

  if plan_has_compute_replace; then
    echo "[pre-apply] Replace ALB/SG/TG detectado — re-sync state (ronda $round)..."
    sync_state
    bash "$SCRIPTS/import-plan-creates.sh" pre-apply.plan
    continue
  fi
  break
done

if plan_has_compute_deletes; then
  echo "::error::El plan quiere destruir ALB/SG/TG sin recrearlos."
  log_plan_summary
  exit 1
fi

if plan_has_compute_replace; then
  echo "::warning::El plan aún propone replace en ALB/SG/TG — continuando (ignore_changes activo)."
fi

log_plan_summary

bash "$SCRIPTS/guard-network-plan.sh" pre-apply.plan

echo "[pre-apply] Apply..."
tf_apply
