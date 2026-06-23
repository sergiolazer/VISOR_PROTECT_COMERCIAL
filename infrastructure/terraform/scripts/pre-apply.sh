#!/usr/bin/env bash
# Pre-apply atómico con reintentos: import → reconcile → plan → guard → apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infrastructure/terraform"
SCRIPTS="${ROOT}/infrastructure/terraform/scripts"
MAX_ROUNDS=5

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

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "[pre-apply] Ronda ${round}/${MAX_ROUNDS}"

  cd "$ROOT"
  bash "$SCRIPTS/bootstrap-import.sh"
  bash "$SCRIPTS/reconcile-state.sh"

  cd "$TF_DIR"

  set +e
  terraform plan -input=false -no-color -out=pre-apply.plan -detailed-exitcode
  ec=$?
  set -e

  if [ "$ec" -eq 1 ]; then
    echo "::error::terraform plan falló antes del apply"
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

  bash "$SCRIPTS/guard-network-plan.sh" pre-apply.plan

  echo "[pre-apply] Apply (state reconciliado, sin plan congelado)..."
  terraform apply -input=false -auto-approve
  exit 0
done

echo "::error::Plan sigue con deletes prohibidos tras ${MAX_ROUNDS} rondas"
terraform show -no-color pre-apply.plan | grep -E 'destroy|delete|replace|apprunner|private_[ab]|vpc\.main' || true
exit 1
