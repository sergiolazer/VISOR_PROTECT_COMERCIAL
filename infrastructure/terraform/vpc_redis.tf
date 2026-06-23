# --- VPC para ElastiCache + ECS Fargate ---

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${local.name_prefix}-private-a"
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [availability_zone]
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${local.name_prefix}-private-b"
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [availability_zone]
  }
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis"
  description = "Redis ElastiCache"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "redis_from_ecs" {
  count = local.enable_compute ? 1 : 0

  type                     = "ingress"
  description              = "Redis desde ECS Fargate"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = aws_security_group.ecs_tasks[0].id
}

# --- ElastiCache Redis ---

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  lifecycle {
    ignore_changes = [subnet_ids]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  lifecycle {
    ignore_changes = [subnet_group_name]
  }

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}
