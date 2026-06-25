# VPC ancla y Security Groups resueltos por tags dentro de esa VPC.
# Evita reglas cross-VPC cuando el state apunta a SGs huérfanos de applies fallidos.

data "aws_vpc" "anchor" {
  filter {
    name   = "tag:Name"
    values = ["${local.name_prefix}-vpc"]
  }
}

locals {
  anchor_vpc_id = data.aws_vpc.anchor.id

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
  # Preferir SG descubierto en VPC ancla; si aún no existe en AWS, usar el recurso gestionado (create).
  alb_sg_id = local.enable_compute ? (
    length(data.aws_security_groups.alb_in_anchor[0].ids) > 0
    ? data.aws_security_groups.alb_in_anchor[0].ids[0]
    : aws_security_group.alb[0].id
  ) : null

  ecs_tasks_sg_id = local.enable_compute ? (
    length(data.aws_security_groups.ecs_tasks_in_anchor[0].ids) > 0
    ? data.aws_security_groups.ecs_tasks_in_anchor[0].ids[0]
    : aws_security_group.ecs_tasks[0].id
  ) : null

  redis_sg_id = length(data.aws_security_groups.redis_in_anchor.ids) > 0 ? (
    data.aws_security_groups.redis_in_anchor.ids[0]
  ) : aws_security_group.redis.id
}
