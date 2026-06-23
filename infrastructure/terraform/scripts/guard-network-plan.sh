#!/usr/bin/env bash
# Aborta si el plan congelado intenta destruir/reemplazar VPC o subnets privadas.
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLAN="${1:-$TF_DIR/deploy.plan}"

if [ ! -f "$PLAN" ]; then
  echo "[guard-network-plan] Sin deploy.plan — omitiendo"
  exit 0
fi

PLAN_TEXT="$(terraform show -no-color "$PLAN")"

if echo "$PLAN_TEXT" | grep -qE 'aws_(vpc\.main|subnet\.private_[ab]).*(must be replaced|will be destroyed)'; then
  echo "::error::El plan intenta destruir o reemplazar VPC/subnets privadas."
  echo "$PLAN_TEXT" | grep -E 'aws_(vpc\.main|subnet\.private_[ab])' || true
  exit 1
fi

echo "[guard-network-plan] OK — sin destroy/replace en red core"
