#!/usr/bin/env bash
# Pre-apply atómico: import → reconcile → plan → guard → apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${ROOT}/infrastructure/terraform"

cd "$ROOT"
bash infrastructure/terraform/scripts/bootstrap-import.sh
bash infrastructure/terraform/scripts/reconcile-state.sh

cd "$TF_DIR"

set +e
terraform plan -input=false -no-color -out=pre-apply.plan -detailed-exitcode
ec=$?
set -e

if [ "$ec" -eq 1 ]; then
  echo "::error::terraform plan falló antes del apply"
  exit 1
fi

bash "${ROOT}/infrastructure/terraform/scripts/guard-network-plan.sh" pre-apply.plan

echo "[pre-apply] Aplicando pre-apply.plan..."
terraform apply -input=false -auto-approve pre-apply.plan
