#!/usr/bin/env bash
# Aborta si el plan congelado intenta destruir/reemplazar VPC o subnets privadas.
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

# Acepta ruta absoluta o relativa; terraform show debe ejecutarse donde corre init.
PLAN_FILE="$(basename "${1:-deploy.plan}")"

if [ ! -f "$PLAN_FILE" ]; then
  echo "[guard-network-plan] Sin $PLAN_FILE — omitiendo"
  exit 0
fi

PLAN_TEXT="$(terraform show -no-color "$PLAN_FILE")"

if echo "$PLAN_TEXT" | grep -qE 'aws_(vpc\.main|subnet\.private_[ab]).*(must be replaced|will be destroyed)'; then
  echo "::error::El plan intenta destruir o reemplazar VPC/subnets privadas."
  echo "$PLAN_TEXT" | grep -E 'aws_(vpc\.main|subnet\.private_[ab])' || true
  exit 1
fi

echo "[guard-network-plan] OK — sin destroy/replace en red core"
