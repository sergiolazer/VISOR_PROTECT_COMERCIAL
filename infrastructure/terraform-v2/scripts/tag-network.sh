#!/usr/bin/env bash
# Etiqueta subnets de la VPC ancla (opcional — v2 también descubre por CIDR).
set -euo pipefail

VPC_ID="${VPC_ANCHOR_ID:-vpc-05414285d00010eff}"
PREFIX="${NAME_PREFIX:-visor-protect-production}"
AWS_REGION="${AWS_REGION:-sa-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"

tag_subnet() {
  local cidr="$1"
  local tier="$2"
  local name="$3"
  local subnet_id

  subnet_id="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=cidr-block,Values=${cidr}" \
    --query 'Subnets[0].SubnetId' --output text)"

  if [ -z "$subnet_id" ] || [ "$subnet_id" = "None" ]; then
    echo "::warning::Subnet no encontrada: ${cidr} en ${VPC_ID}"
    return 0
  fi

  echo "[tag-network] ${subnet_id} (${cidr}) -> Tier=${tier} Name=${name}"
  aws ec2 create-tags --resources "$subnet_id" --tags \
    "Key=Tier,Value=${tier}" \
    "Key=Name,Value=${name}" \
    "Key=Project,Value=visor-protect" \
    "Key=Environment,Value=production" \
    "Key=ManagedBy,Value=terraform"
}

tag_subnet "10.20.1.0/24"  "private" "${PREFIX}-private-a"
tag_subnet "10.20.2.0/24"  "private" "${PREFIX}-private-b"
tag_subnet "10.20.10.0/24" "public"  "${PREFIX}-public-a"
tag_subnet "10.20.11.0/24" "public"  "${PREFIX}-public-b"

echo "[tag-network] Completado"
