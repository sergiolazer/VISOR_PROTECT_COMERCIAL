#!/usr/bin/env bash
# VPC ancla = VPC del cluster ElastiCache Redis en ejecución.
# Ignora subnet IDs obsoletos en el subnet group y evita la VPC huérfana 10.20.0.0/16 duplicada.

ANCHOR_PRIVATE_CIDRS=("10.20.1.0/24" "10.20.2.0/24")
KNOWN_ORPHAN_VPC="vpc-0bf20c37978ae8d93"

discover_anchor_vpc_id() {
  local prefix="$1"
  local vpc_id redis_sg candidate_vpcs vpc has_b

  [ -z "$prefix" ] && return 0

  # 1) VPC del security group del cluster Redis (fuente de verdad)
  redis_sg="$(aws elasticache describe-cache-clusters \
    --cache-cluster-id "${prefix}-redis" \
    --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text 2>/dev/null || echo "")"
  if [ -n "$redis_sg" ] && [ "$redis_sg" != "None" ]; then
    vpc_id="$(sg_live_vpc_id "$redis_sg")"
    if [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ]; then
      echo "$vpc_id"
      return 0
    fi
  fi

  # 2) VPC con ambas subnets 10.20.1/2, excluyendo la huérfana conocida
  candidate_vpcs="$(aws ec2 describe-subnets \
    --filters "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[0]}" \
    --query 'Subnets[].VpcId' --output text 2>/dev/null || echo "")"

  for vpc_id in $candidate_vpcs; do
    [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ] && continue
    [ "$vpc_id" = "$KNOWN_ORPHAN_VPC" ] && continue
    has_b="$(aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=${vpc_id}" "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[1]}" \
      --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
    if [ -n "$has_b" ] && [ "$has_b" != "None" ]; then
      echo "$vpc_id"
      return 0
    fi
  done

  echo ""
}

reconcile_redis_subnet_group() {
  local prefix="$1"
  local vpc_id subnet_a subnet_b group_name current_ids live_ids sid

  [ -z "$prefix" ] && return 0

  vpc_id="$(discover_anchor_vpc_id "$prefix")"
  [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ] || return 0

  subnet_a="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[0]}" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  subnet_b="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[1]}" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"

  if [ -z "$subnet_a" ] || [ "$subnet_a" = "None" ] || [ -z "$subnet_b" ] || [ "$subnet_b" = "None" ]; then
    echo "[vpc-anchor] Sin subnets 10.20.1/2 en VPC $vpc_id — omitir reconcile subnet group"
    return 0
  fi

  group_name="${prefix}-redis"
  current_ids="$(aws elasticache describe-cache-subnet-groups \
    --cache-subnet-group-name "$group_name" \
    --query 'CacheSubnetGroups[0].Subnets[].SubnetIdentifier' --output text 2>/dev/null || echo "")"

  live_ids=""
  for sid in $current_ids; do
    [ -z "$sid" ] || [ "$sid" = "None" ] && continue
    if aws ec2 describe-subnets --subnet-ids "$sid" --query 'Subnets[0].SubnetId' --output text 2>/dev/null | grep -q '^subnet-'; then
      live_ids="$live_ids $sid"
    else
      echo "[vpc-anchor] Subnet obsoleta en subnet group Redis: $sid"
    fi
  done

  if echo "$live_ids" | grep -q "$subnet_a" && echo "$live_ids" | grep -q "$subnet_b" \
    && [ "$(echo "$live_ids" | wc -w | tr -d ' ')" -eq 2 ]; then
    echo "[vpc-anchor] Subnet group Redis OK ($subnet_a $subnet_b)"
    return 0
  fi

  echo "[vpc-anchor] Actualizando subnet group Redis → $subnet_a $subnet_b (VPC $vpc_id)"
  if aws elasticache modify-cache-subnet-group \
    --cache-subnet-group-name "$group_name" \
    --subnet-ids "$subnet_a" "$subnet_b" >/dev/null 2>&1; then
    echo "[vpc-anchor] Subnet group Redis actualizado"
  else
    echo "::warning::No se pudo actualizar subnet group Redis (¿cluster en modifying?)"
  fi
}

sg_live_vpc_id() {
  local sg_id="$1"
  [ -z "$sg_id" ] || [ "$sg_id" = "None" ] && return 0
  aws ec2 describe-security-groups --group-ids "$sg_id" \
    --query 'SecurityGroups[0].VpcId' --output text 2>/dev/null || echo ""
}

sg_in_vpc() {
  local sg_id="$1"
  local vpc_id="$2"
  local live
  [ -z "$sg_id" ] || [ "$sg_id" = "None" ] && return 1
  [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ] && return 1
  live="$(sg_live_vpc_id "$sg_id")"
  [ -n "$live" ] && [ "$live" != "None" ] && [ "$live" = "$vpc_id" ]
}

sg_by_name_in_vpc() {
  local vpc_id="$1"
  local group_name="$2"
  [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ] && return 0
  aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=group-name,Values=${group_name}" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo ""
}

route_table_vpc_id() {
  local rtb_id="$1"
  [ -z "$rtb_id" ] || [ "$rtb_id" = "None" ] && return 0
  aws ec2 describe-route-tables --route-table-ids "$rtb_id" \
    --query 'RouteTables[0].VpcId' --output text 2>/dev/null || echo ""
}

discover_private_route_table_in_vpc() {
  local vpc_id="$1"
  local prefix="${2:-}"
  local subnet_id rtb

  [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ] && return 0

  if [ -n "$prefix" ]; then
    rtb="$(aws ec2 describe-route-tables \
      --filters "Name=vpc-id,Values=${vpc_id}" "Name=tag:Name,Values=${prefix}-private-rt" \
      --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo "")"
    if [ -n "$rtb" ] && [ "$rtb" != "None" ]; then
      echo "$rtb"
      return 0
    fi
  fi

  subnet_id="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${vpc_id}" "Name=cidr-block,Values=10.20.1.0/24" \
    --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
  if [ -z "$subnet_id" ] || [ "$subnet_id" = "None" ]; then
    return 0
  fi

  aws ec2 describe-route-tables \
    --filters "Name=association.subnet-id,Values=${subnet_id}" \
    --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo ""
}

# Regla egress 0.0.0.0/0 ALL (sgr-xxx) — import Terraform aws_security_group_rule.
discover_sg_egress_all_rule() {
  local sg="$1"

  [ -z "$sg" ] || [ "$sg" = "None" ] && return 0

  aws ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=${sg}" \
    --query "SecurityGroupRules[?IsEgress==\`true\` && CidrIpv4=='0.0.0.0/0' && IpProtocol=='-1'].SecurityGroupRuleId | [0]" \
    --output text 2>/dev/null || echo ""
}
