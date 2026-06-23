#!/usr/bin/env bash
# Quita taints y retira recursos legacy (App Runner) del state sin destroy en AWS.
set -uo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TF_DIR"

echo "[reconcile-state] Estabilizando recursos de red y Redis..."

STABLE=(
  aws_vpc.main
  aws_subnet.private_a
  aws_subnet.private_b
  aws_security_group.redis
  aws_elasticache_subnet_group.redis
  aws_elasticache_cluster.redis
)

for addr in "${STABLE[@]}"; do
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    terraform untaint "$addr" 2>/dev/null && echo "  untaint $addr" || true
  fi
done

LEGACY=(
  aws_security_group.apprunner_connector
  'aws_apprunner_vpc_connector.main[0]'
  'aws_apprunner_service.backend[0]'
  'aws_apprunner_auto_scaling_configuration_version.backend[0]'
  'aws_cloudwatch_log_group.apprunner[0]'
  aws_iam_role.apprunner_ecr_access
  aws_iam_role.apprunner_instance
  'aws_iam_role_policy.apprunner_instance'
)

for addr in "${LEGACY[@]}"; do
  if terraform state show -no-color "$addr" >/dev/null 2>&1; then
    echo "  state rm $addr (sin destroy)"
    terraform state rm "$addr" || true
  fi
done

echo "[reconcile-state] Completado"
