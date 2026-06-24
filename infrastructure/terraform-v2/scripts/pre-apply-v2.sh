#!/usr/bin/env bash
# Plan + apply controlado para terraform-v2 (state remoto S3).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT}/environments/production"
BACKEND_CONFIG="${TF_BACKEND_CONFIG:-${ROOT}/backend.hcl}"
VAR_FILE="${TF_VAR_FILE:-${ROOT}/terraform.tfvars}"
PLAN_FILE="${TF_PLAN_FILE:-migrate.plan}"
PLAN_TIMEOUT="${TF_PLAN_TIMEOUT_SEC:-600}"

cd "$TF_DIR"

if [ ! -f "$BACKEND_CONFIG" ]; then
  echo "::error::Falta backend config: $BACKEND_CONFIG"
  echo "Copia backend.hcl.example y configura bucket DynamoDB."
  exit 1
fi

echo "[pre-apply-v2] init..."
terraform init -input=false -backend-config="$BACKEND_CONFIG"

if [ -f "${ROOT}/scripts/import-v2.sh" ] && [ "${SKIP_IMPORT_V2:-false}" != "true" ]; then
  echo "[pre-apply-v2] import-v2 (adopción AWS)..."
  bash "${ROOT}/scripts/import-v2.sh" || true
fi

echo "[pre-apply-v2] plan..."
if ! timeout "$PLAN_TIMEOUT" terraform plan -input=false -no-color -out="$PLAN_FILE" ${VAR_FILE:+-var-file="$VAR_FILE"}; then
  echo "::error::terraform plan falló"
  exit 1
fi

echo "[pre-apply-v2] resumen:"
terraform show -json "$PLAN_FILE" | jq -r '
  [.resource_changes[]
    | {address, actions: .change.actions}
  ] | .[] | "\(.address): \(.actions | join(","))"'
  2>/dev/null || terraform show -no-color "$PLAN_FILE" | head -60

if [ "${TF_APPLY:-false}" != "true" ]; then
  echo "[pre-apply-v2] Plan guardado en $PLAN_FILE — export TF_APPLY=true para aplicar."
  exit 0
fi

echo "[pre-apply-v2] apply..."
terraform apply -input=false -auto-approve "$PLAN_FILE"
