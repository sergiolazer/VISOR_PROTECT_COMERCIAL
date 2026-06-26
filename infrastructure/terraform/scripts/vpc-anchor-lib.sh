#!/usr/bin/env bash
# VPC ancla = VPC con subnets privadas 10.20.1/2 (Redis + ECS). Ignora IDs obsoletos en subnet groups.

ANCHOR_PRIVATE_CIDRS=("10.20.1.0/24" "10.20.2.0/24")

discover_anchor_vpc_id() {
  local prefix="$1"
  local vpc_id cache_subnet subnet_ids redis_sg has_b

  [ -z "$prefix" ] && return 0

  # 1) Canónico: VPC que contiene ambas subnets privadas del stack
  vpc_id="$(aws ec2 describe-subnets \
    --filters "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[0]}" \
    --query 'Subnets[0].VpcId' --output text 2>/dev/null || echo "")"
  if [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ]; then
    has_b="$(aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=${vpc_id}" "Name=cidr-block,Values=${ANCHOR_PRIVATE_CIDRS[1]}" \
      --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")"
    if [ -n "$has_b" ] && [ "$has_b" != "None" ]; then
      echo "$vpc_id"
      return 0
    fi
  fi

  # 2) Subnets del subnet group Redis con CIDR privado (no el primer ID obsoleto)
  cache_subnet="$(aws elasticache describe-cache-clusters \
    --cache-cluster-id "${prefix}-redis" \
    --query 'CacheClusters[0].CacheSubnetGroupName' --output text 2>/dev/null || echo "")"

  if [ -n "$cache_subnet" ] && [ "$cache_subnet" != "None" ]; then
    subnet_ids="$(aws elasticache describe-cache-subnet-groups \
      --cache-subnet-group-name "$cache_subnet" \
      --query 'SubnetIds' --output text 2>/dev/null || echo "")"
    if [ -n "$subnet_ids" ] && [ "$subnet_ids" != "None" ]; then
      vpc_id="$(aws ec2 describe-subnets --subnet-ids $subnet_ids \
        --query 'Subnets[?CidrBlock==`10.20.1.0/24` || CidrBlock==`10.20.2.0/24`] | [0].VpcId' \
        --output text 2>/dev/null || echo "")"
      if [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ]; then
        echo "$vpc_id"
        return 0
      fi
    fi
  fi

  # 3) VPC del security group de Redis en ejecución
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

  echo ""
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
