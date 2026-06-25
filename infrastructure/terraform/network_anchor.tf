# VPC ancla y Security Groups dentro de esa VPC.
# La VPC ancla se deriva del subnet group ElastiCache Redis (único); NO usar tag:Name
# porque existen 2 VPCs con el mismo nombre (ancla + huérfana).

data "aws_elasticache_subnet_group" "anchor" {
  name = "${local.name_prefix}-redis"
}

data "aws_subnet" "anchor_probe" {
  id = tolist(data.aws_elasticache_subnet_group.anchor.subnet_ids)[0]
}

locals {
  anchor_vpc_id = data.aws_subnet.anchor_probe.vpc_id

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

locals {
  alb_sg_discovered = local.enable_compute && length(data.aws_security_groups.alb_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.alb_in_anchor[0].ids[0]
  ) : null

  ecs_sg_discovered = local.enable_compute && length(data.aws_security_groups.ecs_tasks_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.ecs_tasks_in_anchor[0].ids[0]
  ) : null

  managed_alb_sg_in_anchor = local.enable_compute && aws_security_group.alb[0].vpc_id == local.anchor_vpc_id
  managed_ecs_sg_in_anchor = local.enable_compute && aws_security_group.ecs_tasks[0].vpc_id == local.anchor_vpc_id

  alb_sg_id = local.enable_compute ? coalesce(
    local.alb_sg_discovered,
    local.managed_alb_sg_in_anchor ? aws_security_group.alb[0].id : null
  ) : null

  ecs_tasks_sg_id = local.enable_compute ? coalesce(
    local.ecs_sg_discovered,
    local.managed_ecs_sg_in_anchor ? aws_security_group.ecs_tasks[0].id : null
  ) : null

  redis_sg_id = length(data.aws_security_groups.redis_in_anchor.ids) > 0 ? (
    data.aws_security_groups.redis_in_anchor.ids[0]
  ) : (
    aws_security_group.redis.vpc_id == local.anchor_vpc_id ? aws_security_group.redis.id : null
  )

  ecs_alb_rule_ready = local.enable_compute && local.alb_sg_id != null && local.ecs_tasks_sg_id != null
}
