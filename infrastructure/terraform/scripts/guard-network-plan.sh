#!/usr/bin/env bash
# Aborta si el plan intenta delete/replace en red core o recursos App Runner legacy.
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PLAN_FILE="$(basename "${1:-deploy.plan}")"

if [ ! -f "$PLAN_FILE" ]; then
  echo "[guard-network-plan] Sin $PLAN_FILE — omitiendo"
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  PLAN_TEXT="$(terraform show -no-color "$PLAN_FILE")"
  if echo "$PLAN_TEXT" | grep -qE 'aws_(vpc\.main|subnet\.private_[ab]|security_group\.apprunner_connector|apprunner).*(must be replaced|will be destroyed)'; then
    echo "::error::Plan inseguro (grep): destroy/replace en red o App Runner"
    exit 1
  fi
  echo "[guard-network-plan] OK (grep)"
  exit 0
fi

UNSAFE="$(
  terraform show -json "$PLAN_FILE" | jq -r '
    [.resource_changes[]
      | select([.change.actions[]] | any(. == "delete"))
      | select(.address | test("aws_vpc\\.main|aws_subnet\\.private_[ab]|apprunner|apprunner_connector"))
      | .address
    ] | unique | .[]
  '
)"

if [ -n "$UNSAFE" ]; then
  echo "::error::Plan intenta DELETE recursos protegidos:"
  echo "$UNSAFE"
  terraform show -no-color "$PLAN_FILE" | grep -E 'destroy|delete|replace|apprunner|private_[ab]|vpc\.main' || true
  exit 1
fi

REPLACE_UNSAFE="$(
  terraform show -json "$PLAN_FILE" | jq -r '
    [.resource_changes[]
      | select(
          ([.change.actions[]] | any(. == "delete"))
          and ([.change.actions[]] | any(. == "create"))
        )
      | select(.address | test("aws_subnet\\.private_[ab]|aws_vpc\\.main"))
      | .address
    ] | unique | .[]
  '
)"

if [ -n "$REPLACE_UNSAFE" ]; then
  echo "::error::Plan intenta REEMPLAZAR VPC/subnets privadas:"
  echo "$REPLACE_UNSAFE"
  exit 1
fi

echo "[guard-network-plan] OK — sin delete/replace en red core ni App Runner"
