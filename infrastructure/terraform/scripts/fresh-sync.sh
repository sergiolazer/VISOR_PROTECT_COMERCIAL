#!/usr/bin/env bash
# Sincronización limpia del state con AWS (sin importar ECS service).
# Uso local o en CI cuando hay drift severo:
#   cd infrastructure/terraform && bash scripts/fresh-sync.sh
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TF_DIR"

export TF_VAR_enable_ecs="${TF_VAR_enable_ecs:-true}"
export TF_VAR_enable_app_runner="${TF_VAR_enable_app_runner:-false}"
export TF_VAR_github_org="${TF_VAR_github_org:-bootstrap-import}"
export TF_VAR_cors_origin="${TF_VAR_cors_origin:-http://localhost:5173}"
export TF_VAR_aws_region="${TF_VAR_aws_region:-sa-east-1}"

echo "[fresh-sync] Init..."
terraform init -input=false

echo "[fresh-sync] Bootstrap + reconcile..."
bash "$SCRIPTS/bootstrap-import.sh"
bash "$SCRIPTS/reconcile-state.sh"

echo "[fresh-sync] Plan (sin apply)..."
terraform plan -input=false -no-color -detailed-exitcode \
  -var="enable_ecs=${TF_VAR_enable_ecs}" \
  -var="enable_app_runner=${TF_VAR_enable_app_runner}" \
  -out=fresh-sync.plan || ec=$?
ec="${ec:-0}"

if [ "$ec" -eq 1 ]; then
  echo "::error::terraform plan falló"
  exit 1
fi

echo "[fresh-sync] Resumen:"
terraform show -json fresh-sync.plan | jq -r '
  [.resource_changes[]
    | {address, actions: .change.actions}
  ] | .[] | "\(.address): \(.actions | join(","))"'
  2>/dev/null || terraform show -no-color fresh-sync.plan | head -50

echo "[fresh-sync] OK — sube terraform.tfstate como artifact o ejecuta pre-apply.sh"
