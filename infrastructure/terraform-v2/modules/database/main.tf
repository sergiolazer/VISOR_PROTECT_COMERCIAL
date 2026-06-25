# Database layer: ElastiCache Redis (cache + Pub/Sub).
# MongoDB Atlas vive FUERA de AWS — solo referencia vía Secrets Manager en módulo security.

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" {
  type = list(string)
}
variable "redis_node_type" { type = string }
variable "ecs_tasks_security_group_id" {
  type        = string
  default     = null
  description = "SG ECS explícito; si null, se descubre por nombre en vpc_id cuando enable_ecs_ingress=true"
}
variable "enable_ecs_ingress" {
  type        = bool
  default     = false
  description = "Crea regla Redis←ECS resolviendo SG ECS por tags en la VPC"
}
variable "tags" { type = map(string) }

data "aws_security_groups" "ecs_tasks_in_vpc" {
  count = var.enable_ecs_ingress && var.ecs_tasks_security_group_id == null ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "group-name"
    values = ["${var.name_prefix}-ecs"]
  }
}

locals {
  ecs_tasks_sg_id = var.ecs_tasks_security_group_id != null ? var.ecs_tasks_security_group_id : (
    var.enable_ecs_ingress && try(length(data.aws_security_groups.ecs_tasks_in_vpc[0].ids), 0) > 0
    ? data.aws_security_groups.ecs_tasks_in_vpc[0].ids[0]
    : null
  )
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis"
  description = "Redis ElastiCache"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-redis"
    Component = "database"
  })

  lifecycle {
    # Tier 1: importar existente; evitar replace accidental
    create_before_destroy = true
    ignore_changes        = [name, description]
  }
}

resource "aws_security_group_rule" "redis_from_ecs" {
  count = local.ecs_tasks_sg_id != null ? 1 : 0

  type                     = "ingress"
  description              = "Redis desde ECS Fargate"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = local.ecs_tasks_sg_id
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name_prefix}-redis"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, { Component = "database" })

  lifecycle {
    ignore_changes = [subnet_ids]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-redis"
    Component = "database"
  })

  lifecycle {
    # Tier 1 — no recrear en migración
    prevent_destroy = true
    ignore_changes = [
      engine_version,
      parameter_group_name,
      security_group_ids,
      subnet_group_name,
    ]
  }
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_security_group_id" {
  value = aws_security_group.redis.id
}
