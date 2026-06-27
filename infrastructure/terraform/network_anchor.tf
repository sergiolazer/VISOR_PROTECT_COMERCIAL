# VPC ancla y Security Groups dentro de esa VPC.

data "aws_elasticache_subnet_group" "anchor" {
  name = "${local.name_prefix}-redis"
}

data "aws_vpcs" "anchor" {
  filter {
    name   = "cidr-block"
    values = ["10.20.0.0/16"]
  }

  filter {
    name   = "tag:Name"
    values = ["${local.name_prefix}-vpc"]
  }
}

data "aws_subnets" "private_a_anchor" {
  count = length(data.aws_vpcs.anchor.ids) > 0 ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpcs.anchor.ids[0]]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.1.0/24"]
  }
}

data "aws_subnets" "private_b_anchor" {
  count = length(data.aws_vpcs.anchor.ids) > 0 ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpcs.anchor.ids[0]]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.2.0/24"]
  }
}

data "aws_subnets" "public_a_anchor" {
  count = length(data.aws_vpcs.anchor.ids) > 0 ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpcs.anchor.ids[0]]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.10.0/24"]
  }
}

data "aws_subnets" "public_b_anchor" {
  count = length(data.aws_vpcs.anchor.ids) > 0 ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpcs.anchor.ids[0]]
  }

  filter {
    name   = "cidr-block"
    values = ["10.20.11.0/24"]
  }
}

data "aws_route_tables" "private_anchor" {
  count = length(data.aws_subnets.private_a_anchor) > 0 && length(data.aws_subnets.private_a_anchor[0].ids) > 0 ? 1 : 0

  filter {
    name   = "association.subnet-id"
    values = [data.aws_subnets.private_a_anchor[0].ids[0]]
  }
}

locals {
  anchor_vpc_id = length(data.aws_vpcs.anchor.ids) > 0 ? data.aws_vpcs.anchor.ids[0] : coalesce(
    try(aws_vpc.main.id, null),
    try(aws_subnet.private_a.vpc_id, null)
  )

  private_a_anchor_id = length(data.aws_subnets.private_a_anchor) > 0 && length(data.aws_subnets.private_a_anchor[0].ids) > 0 ? data.aws_subnets.private_a_anchor[0].ids[0] : try(aws_subnet.private_a.id, null)
  private_b_anchor_id = length(data.aws_subnets.private_b_anchor) > 0 && length(data.aws_subnets.private_b_anchor[0].ids) > 0 ? data.aws_subnets.private_b_anchor[0].ids[0] : try(aws_subnet.private_b.id, null)

  public_a_anchor_id = length(data.aws_subnets.public_a_anchor) > 0 && length(data.aws_subnets.public_a_anchor[0].ids) > 0 ? data.aws_subnets.public_a_anchor[0].ids[0] : try(aws_subnet.public_a[0].id, null)
  public_b_anchor_id = length(data.aws_subnets.public_b_anchor) > 0 && length(data.aws_subnets.public_b_anchor[0].ids) > 0 ? data.aws_subnets.public_b_anchor[0].ids[0] : try(aws_subnet.public_b[0].id, null)

  private_anchor_route_table_id = length(data.aws_route_tables.private_anchor) > 0 && length(data.aws_route_tables.private_anchor[0].ids) > 0 ? data.aws_route_tables.private_anchor[0].ids[0] : try(aws_route_table.private[0].id, null)

  sg_name_alb       = "${local.name_prefix}-alb"
  sg_name_ecs_tasks = "${local.name_prefix}-ecs"
  sg_name_redis     = "${local.name_prefix}-redis"
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

  ecs_alb_rule_ready = try(
    local.enable_compute
    && data.aws_security_group.alb_anchor_live[0].vpc_id == data.aws_security_group.ecs_anchor_live[0].vpc_id
    && data.aws_security_group.alb_anchor_live[0].vpc_id == local.anchor_vpc_id,
    false
  )
}
