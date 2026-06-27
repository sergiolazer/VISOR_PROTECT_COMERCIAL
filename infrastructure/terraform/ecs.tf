# ECS Fargate + ALB — reemplazo de App Runner (sunset clientes nuevos 2026)

resource "aws_ecs_cluster" "backend" {
  count = local.enable_compute ? 1 : 0

  name = "${local.name_prefix}-backend"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  count = local.enable_compute ? 1 : 0

  name              = "/ecs/${local.name_prefix}-backend"
  retention_in_days = 14
}

resource "aws_security_group" "alb" {
  count = local.enable_compute ? 1 : 0

  name        = local.sg_name_alb
  description = "ALB ingress HTTP/HTTPS"
  vpc_id      = local.anchor_vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
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

  tags = {
    Name      = local.sg_name_alb
    Component = "compute"
  }

  lifecycle {
    ignore_changes = [name, description, ingress, egress, vpc_id, tags, tags_all]
  }
}

resource "aws_security_group" "ecs_tasks" {
  count = local.enable_compute ? 1 : 0

  name        = local.sg_name_ecs_tasks
  description = "ECS Fargate tasks"
  vpc_id      = local.anchor_vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = local.sg_name_ecs_tasks
    Component = "compute"
  }

  lifecycle {
    ignore_changes = [name, description, egress, vpc_id, tags, tags_all]
  }
}

resource "aws_security_group_rule" "ecs_tasks_from_alb" {
  count = local.ecs_alb_rule_ready ? 1 : 0

  type                     = "ingress"
  description              = "Backend from ALB"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  security_group_id        = local.ecs_sg_discovered
  source_security_group_id = local.alb_sg_discovered
}

resource "aws_lb" "backend" {
  count = local.enable_compute ? 1 : 0

  name               = "${local.name_prefix}-backend"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [local.alb_sg_id]
  subnets            = compact([local.public_a_anchor_id, local.public_b_anchor_id])

  tags = {
    Name = "${local.name_prefix}-backend-alb"
  }

  lifecycle {
    ignore_changes = [name, security_groups, subnets]
  }
}

resource "aws_lb_target_group" "backend" {
  count = local.enable_compute ? 1 : 0

  name        = "${local.name_prefix}-backend"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = local.anchor_vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  lifecycle {
    ignore_changes = [name, health_check, stickiness, vpc_id]
  }
}

resource "aws_lb_listener" "http" {
  count = local.enable_compute ? 1 : 0

  load_balancer_arn = aws_lb.backend[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend[0].arn
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

resource "aws_iam_role" "ecs_execution" {
  count = local.enable_compute ? 1 : 0

  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  count = local.enable_compute ? 1 : 0

  role       = aws_iam_role.ecs_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  count = local.enable_compute ? 1 : 0

  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.mongo_uri.arn,
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.cloudinary.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  count = local.enable_compute ? 1 : 0

  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task" {
  count = local.enable_compute ? 1 : 0

  name = "${local.name_prefix}-ecs-task"
  role = aws_iam_role.ecs_task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.mongo_uri.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.cloudinary.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.media.arn
      },
    ]
  })
}

resource "aws_ecs_task_definition" "backend" {
  count = local.enable_compute ? 1 : 0

  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_execution[0].arn
  task_role_arn            = aws_iam_role.ecs_task[0].arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:${var.ecr_image_tag}"
    essential = true

    portMappings = [{
      containerPort = 3001
      hostPort      = 3001
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3001" },
      { name = "CORS_ORIGIN", value = var.cors_origin },
      { name = "COOKIE_SECURE", value = "true" },
      { name = "COOKIE_SAME_SITE", value = "none" },
      { name = "REDIS_ENABLED", value = "true" },
      { name = "REDIS_URL", value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379" },
      { name = "MONGODB_CHANGE_STREAM", value = "true" },
      { name = "ALERT_FILTER_TELEMETRY_DEBUG", value = "false" },
      { name = "ALERT_FILTER_TELEMETRY_PERSIST", value = "true" },
    ]

    secrets = [
      { name = "MONGO_URI", valueFrom = aws_secretsmanager_secret.mongo_uri.arn },
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
      { name = "CLOUDINARY_CLOUD_NAME", valueFrom = "${aws_secretsmanager_secret.cloudinary.arn}:cloud_name::" },
      { name = "CLOUDINARY_API_KEY", valueFrom = "${aws_secretsmanager_secret.cloudinary.arn}:api_key::" },
      { name = "CLOUDINARY_API_SECRET", valueFrom = "${aws_secretsmanager_secret.cloudinary.arn}:api_secret::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs[0].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "backend" {
  count = local.enable_compute ? 1 : 0

  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.backend[0].id
  task_definition = aws_ecs_task_definition.backend[0].arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = compact([local.private_a_anchor_id, local.private_b_anchor_id])
    security_groups  = [local.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend[0].arn
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
