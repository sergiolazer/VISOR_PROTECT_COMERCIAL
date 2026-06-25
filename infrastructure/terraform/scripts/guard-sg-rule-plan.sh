#!/usr/bin/env bash
# Bloquea apply si el plan crea aws_security_group_rule.ecs_tasks_from_alb cross-VPC.
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

PLAN_FILE="$(basename "${1:-pre-apply.plan}")"
[ -f "$PLAN_FILE" ] || exit 0

PROJECT="${TF_VAR_project_name:-visor-protect}"
ENV="${TF_VAR_environment:-production}"
PREFIX="${PROJECT}-${ENV}"

# shellcheck source=vpc-anchor-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vpc-anchor-lib.sh"

if ! command -v jq >/dev/null 2>&1; then
  echo "[guard-sg-rule] jq no disponible — omitiendo"
  exit 0
fi

RULE_JSON="$(terraform show -json "$PLAN_FILE" | jq -c '
  [.resource_changes[]
    | select(.address == "aws_security_group_rule.ecs_tasks_from_alb[0]")
    | select([.change.actions[]] | any(. == "create"))
    | .change.after
  ] | .[0] // empty
')"

[ -z "$RULE_JSON" ] || [ "$RULE_JSON" = "null" ] && exit 0

ECS_SG="$(echo "$RULE_JSON" | jq -r '.security_group_id // empty')"
ALB_SG="$(echo "$RULE_JSON" | jq -r '.source_security_group_id // empty')"
ANCHOR="$(discover_anchor_vpc_id "$PREFIX")"

ECS_VPC="$(sg_live_vpc_id "$ECS_SG")"
ALB_VPC="$(sg_live_vpc_id "$ALB_SG")"

echo "[guard-sg-rule] Regla ECS←ALB: ecs=$ECS_SG ($ECS_VPC) alb=$ALB_SG ($ALB_VPC) ancla=$ANCHOR"

if [ -z "$ECS_VPC" ] || [ -z "$ALB_VPC" ] || [ "$ECS_VPC" != "$ALB_VPC" ]; then
  echo "::error::Regla ECS-ALB cross-VPC ($ECS_VPC vs $ALB_VPC). No aplicar."
  exit 1
fi

if [ -n "$ANCHOR" ] && [ "$ANCHOR" != "None" ] && [ "$ECS_VPC" != "$ANCHOR" ]; then
  echo "::error::SGs de la regla ECS-ALB no están en VPC ancla $ANCHOR (están en $ECS_VPC)."
  exit 1
fi

echo "[guard-sg-rule] OK — misma VPC para regla ECS-ALB"
