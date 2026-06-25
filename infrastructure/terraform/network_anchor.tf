# VPC ancla y Security Groups dentro de esa VPC.
# La VPC ancla se deriva del subnet group ElastiCache Redis (único).

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
  # IDs verificados en VPC ancla (única fuente para reglas cross-SG).
  alb_sg_discovered = local.enable_compute && length(data.aws_security_groups.alb_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.alb_in_anchor[0].ids[0]
  ) : null

  ecs_sg_discovered = local.enable_compute && length(data.aws_security_groups.ecs_tasks_in_anchor[0].ids) > 0 ? (
    data.aws_security_groups.ecs_tasks_in_anchor[0].ids[0]
  ) : null

  redis_sg_discovered = length(data.aws_security_groups.redis_in_anchor.ids) > 0 ? (
    data.aws_security_groups.redis_in_anchor.ids[0]
  ) : null

  # ALB/ECS service: descubierto en ancla, o recurso gestionado en create (sin regla cross-SG hasta el próximo plan).
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

  # Regla ALB→ECS solo con ambos SG confirmados en VPC ancla vía data source.
  ecs_alb_rule_ready = local.enable_compute && local.alb_sg_discovered != null && local.ecs_sg_discovered != null
}
