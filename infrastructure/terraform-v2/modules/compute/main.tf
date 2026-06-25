# ECS Fargate + ALB — recreable con rolling deploy (Tier 2).

variable "name_prefix" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "ecr_repository_url" { type = string }
variable "ecr_image_tag" { type = string }
variable "cors_origin" { type = string }
variable "redis_url" { type = string }
variable "log_group_name" { type = string }
variable "secrets_arns" {
  type = object({
    mongo_uri  = string
    jwt_secret = string
    cloudinary = string
  })
}
variable "execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "ecs_cpu" { type = string }
variable "ecs_memory" { type = string }
variable "ecs_desired_count" { type = number }
variable "discover_existing_network" {
  type        = bool
  default     = false
  description = "true = resolver SG compute por tags en vpc_id (migración)"
}
variable "tags" { type = map(string) }

data "aws_security_groups" "alb_in_vpc" {
  count = var.discover_existing_network ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "group-name"
    values = ["${var.name_prefix}-alb"]
  }
}

data "aws_security_groups" "ecs_tasks_in_vpc" {
  count = var.discover_existing_network ? 1 : 0

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
  alb_sg_id = var.discover_existing_network && length(data.aws_security_groups.alb_in_vpc[0].ids) > 0 ? (
    data.aws_security_groups.alb_in_vpc[0].ids[0]
  ) : aws_security_group.alb.id

  ecs_tasks_sg_id = var.discover_existing_network && length(data.aws_security_groups.ecs_tasks_in_vpc[0].ids) > 0 ? (
    data.aws_security_groups.ecs_tasks_in_vpc[0].ids[0]
  ) : aws_security_group.ecs_tasks.id
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "ALB HTTP/HTTPS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-alb"
    Component = "compute"
  })
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.name_prefix}-ecs"
  description = "ECS Fargate tasks"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-ecs"
    Component = "compute"
  })
}

resource "aws_security_group_rule" "ecs_tasks_from_alb" {
  type                     = "ingress"
  description              = "Backend from ALB"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  security_group_id        = local.ecs_tasks_sg_id
  source_security_group_id = local.alb_sg_id

  lifecycle {
    precondition {
      condition     = local.ecs_tasks_sg_id != null && local.alb_sg_id != null
      error_message = "Security Groups ALB/ECS no resueltos en VPC ${var.vpc_id}."
    }
  }
}

resource "aws_lb" "backend" {
  name               = "${var.name_prefix}-backend"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [local.alb_sg_id]
  subnets            = var.public_subnet_ids

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-backend-alb"
    Component = "compute"
  })
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name_prefix}-backend"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path    = "/health"
    matcher = "200"
  }

  tags = merge(var.tags, { Component = "compute" })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_ecs_cluster" "backend" {
  name = "${var.name_prefix}-backend"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, { Component = "compute" })
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = var.log_group_name
  retention_in_days = 14

  tags = merge(var.tags, { Component = "compute" })
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${var.ecr_repository_url}:${var.ecr_image_tag}"
    essential = true
    portMappings = [{ containerPort = 3001, hostPort = 3001, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3001" },
      { name = "CORS_ORIGIN", value = var.cors_origin },
      { name = "REDIS_ENABLED", value = "true" },
      { name = "REDIS_URL", value = var.redis_url },
    ]
    secrets = [
      { name = "MONGO_URI", valueFrom = var.secrets_arns.mongo_uri },
      { name = "JWT_SECRET", valueFrom = var.secrets_arns.jwt_secret },
      { name = "CLOUDINARY_CLOUD_NAME", valueFrom = "${var.secrets_arns.cloudinary}:cloud_name::" },
      { name = "CLOUDINARY_API_KEY", valueFrom = "${var.secrets_arns.cloudinary}:api_key::" },
      { name = "CLOUDINARY_API_SECRET", valueFrom = "${var.secrets_arns.cloudinary}:api_secret::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "${var.name_prefix}-backend"
  cluster         = aws_ecs_cluster.backend.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [local.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3001
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

output "alb_dns_name" {
  value = aws_lb.backend.dns_name
}

output "alb_arn_suffix" {
  value = aws_lb.backend.arn_suffix
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.backend.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "ecs_tasks_security_group_id" {
  value = local.ecs_tasks_sg_id
}
