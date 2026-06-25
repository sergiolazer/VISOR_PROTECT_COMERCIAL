#!/usr/bin/env bash
# VPC ancla = VPC de subnets Redis que existen en AWS (ignora IDs obsoletos en el subnet group).

discover_anchor_vpc_id() {
  local prefix="$1"
  local cache_subnet subnet_ids vpc_id

  [ -z "$prefix" ] && return 0

  cache_subnet="$(aws elasticache describe-cache-clusters \
    --cache-cluster-id "${prefix}-redis" \
    --query 'CacheClusters[0].CacheSubnetGroupName' --output text 2>/dev/null || echo "")"

  if [ -n "$cache_subnet" ] && [ "$cache_subnet" != "None" ]; then
    subnet_ids="$(aws elasticache describe-cache-subnet-groups \
      --cache-subnet-group-name "$cache_subnet" \
      --query 'SubnetIds' --output text 2>/dev/null || echo "")"
    if [ -n "$subnet_ids" ] && [ "$subnet_ids" != "None" ]; then
      # describe-subnets solo devuelve subnets que existen
      vpc_id="$(aws ec2 describe-subnets \
        --subnet-ids $subnet_ids \
        --query 'Subnets[0].VpcId' --output text 2>/dev/null || echo "")"
      if [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ]; then
        echo "$vpc_id"
        return 0
      fi
    fi
  fi

  vpc_id="$(aws ec2 describe-subnets \
    --filters "Name=cidr-block,Values=10.20.1.0/24" \
    --query 'Subnets[?VpcId!=`null`] | [0].VpcId' --output text 2>/dev/null || echo "")"
  echo "$vpc_id"
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
