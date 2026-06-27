# VPC ancla = la que aloja ElastiCache Redis (subnets 10.20.1/2).
# No usar fallback al state: hay dos VPC 10.20.0.0/16 y los IDs obsoletos rompen endpoints/SG.

data "aws_elasticache_subnet_group" "anchor" {
  name = "${local.name_prefix}-redis"
}

data "aws_subnet" "redis_anchor" {
  for_each = toset(data.aws_elasticache_subnet_group.anchor.subnet_ids)
  id       = each.value
}

locals {
  anchor_vpc_id = one(distinct([for s in values(data.aws_subnet.redis_anchor) : s.vpc_id]))

  private_a_anchor_id = coalesce(
    try(one([for s in values(data.aws_subnet.redis_anchor) : s.id if s.cidr_block == "10.20.1.0/24"]), null),
    length(data.aws_subnets.private_a_in_anchor.ids) > 0 ? data.aws_subnets.private_a_in_anchor.ids[0] : null
  )
  private_b_anchor_id = coalesce(
    try(one([for s in values(data.aws_subnet.redis_anchor) : s.id if s.cidr_block == "10.20.2.0/24"]), null),
    length(data.aws_subnets.private_b_in_anchor.ids) > 0 ? data.aws_subnets.private_b_in_anchor.ids[0] : null
  )
}

data "aws_subnets" "private_a_in_anchor" {
  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.1.0/24"]
  }
}

data "aws_subnets" "private_b_in_anchor" {
  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.2.0/24"]
  }
}

data "aws_subnets" "public_a_anchor" {
  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.10.0/24"]
  }
}

data "aws_subnets" "public_b_anchor" {
  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.11.0/24"]
  }
}

data "aws_route_tables" "private_anchor" {
  filter {
    name   = "association.subnet-id"
    values = [local.private_a_anchor_id]
  }
}

locals {
  public_a_anchor_id = length(data.aws_subnets.public_a_anchor.ids) > 0 ? data.aws_subnets.public_a_anchor.ids[0] : null
  public_b_anchor_id = length(data.aws_subnets.public_b_anchor.ids) > 0 ? data.aws_subnets.public_b_anchor.ids[0] : null

  private_anchor_route_table_id = length(data.aws_route_tables.private_anchor.ids) > 0 ? data.aws_route_tables.private_anchor.ids[0] : null

  sg_name_alb           = "${local.name_prefix}-alb"
  sg_name_ecs_tasks     = "${local.name_prefix}-ecs"
  sg_name_redis         = "${local.name_prefix}-redis"
  sg_name_vpc_endpoints = "${local.name_prefix}-vpc-endpoints"
}

data "aws_security_groups" "alb_in_anchor" {
  count = local.enable_compute ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "group-name"
    values = [local.sg_name_alb]
  }
}

data "aws_security_groups" "ecs_tasks_in_anchor" {
  count = local.enable_compute ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "group-name"
    values = [local.sg_name_ecs_tasks]
  }
}

data "aws_security_groups" "redis_in_anchor" {
  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "group-name"
    values = [local.sg_name_redis]
  }
}

data "aws_security_groups" "vpc_endpoints_in_anchor" {
  count = local.enable_compute ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.anchor_vpc_id]
  }

  filter {
    name   = "group-name"
    values = [local.sg_name_vpc_endpoints]
  }
}

data "aws_security_group" "alb_anchor_live" {
  count = local.enable_compute && length(data.aws_security_groups.alb_in_anchor[0].ids) > 0 ? 1 : 0
  id    = data.aws_security_groups.alb_in_anchor[0].ids[0]
}

data "aws_security_group" "ecs_anchor_live" {
  count = local.enable_compute && length(data.aws_security_groups.ecs_tasks_in_anchor[0].ids) > 0 ? 1 : 0
  id    = data.aws_security_groups.ecs_tasks_in_anchor[0].ids[0]
}

locals {
  alb_sg_discovered = local.enable_compute && length(data.aws_security_groups.alb_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.alb_in_anchor[0].ids[0]
  ) : null

  ecs_sg_discovered = local.enable_compute && length(data.aws_security_groups.ecs_tasks_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.ecs_tasks_in_anchor[0].ids[0]
  ) : null

  redis_sg_discovered = length(data.aws_security_groups.redis_in_anchor.ids) > 0 ? (
    data.aws_security_groups.redis_in_anchor.ids[0]
  ) : null

  vpc_endpoints_sg_discovered = local.enable_compute && length(data.aws_security_groups.vpc_endpoints_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.vpc_endpoints_in_anchor[0].ids[0]
  ) : null

  alb_sg_id = local.enable_compute ? coalesce(
    local.alb_sg_discovered,
    try(aws_security_group.alb[0].id, null)
  ) : null

  ecs_tasks_sg_id = local.enable_compute ? coalesce(
    local.ecs_sg_discovered,
    try(aws_security_group.ecs_tasks[0].id, null)
  ) : null

  redis_sg_id = coalesce(
    local.redis_sg_discovered,
    try(aws_security_group.redis.id, null)
  )

  vpc_endpoints_sg_id = local.enable_compute ? coalesce(
    local.vpc_endpoints_sg_discovered,
    try(aws_security_group.vpc_endpoints[0].id, null)
  ) : null
}
