locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# --- VPC mínima para ElastiCache (App Runner se conecta vía VPC Connector) ---

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${local.name_prefix}-private-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${local.name_prefix}-private-b"
  }
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis"
  description = "Redis ElastiCache — solo tráfico desde App Runner VPC connector"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis desde App Runner"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner_connector.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "apprunner_connector" {
  name        = "${local.name_prefix}-apprunner-connector"
  description = "VPC connector App Runner"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${local.name_prefix}-connector"
  subnets            = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_groups    = [aws_security_group.apprunner_connector.id]
}

# --- ElastiCache Redis ---

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
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

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}
