resource "aws_apprunner_service" "backend" {
  count = var.enable_app_runner ? 1 : 0

  service_name = "${local.name_prefix}-backend"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.backend.repository_url}:${var.ecr_image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "3001"

        runtime_environment_variables = {
          NODE_ENV                       = "production"
          PORT                           = "3001"
          CORS_ORIGIN                    = var.cors_origin
          COOKIE_SECURE                  = "true"
          COOKIE_SAME_SITE               = "none"
          REDIS_ENABLED                  = "true"
          REDIS_URL                      = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
          MONGODB_CHANGE_STREAM          = "true"
          ALERT_FILTER_TELEMETRY_DEBUG   = "false"
          ALERT_FILTER_TELEMETRY_PERSIST = "true"
        }

        runtime_environment_secrets = {
          MONGO_URI             = aws_secretsmanager_secret.mongo_uri.arn
          JWT_SECRET            = aws_secretsmanager_secret.jwt_secret.arn
          CLOUDINARY_CLOUD_NAME = "${aws_secretsmanager_secret.cloudinary.arn}:cloud_name::"
          CLOUDINARY_API_KEY    = "${aws_secretsmanager_secret.cloudinary.arn}:api_key::"
          CLOUDINARY_API_SECRET = "${aws_secretsmanager_secret.cloudinary.arn}:api_secret::"
        }
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = var.app_runner_cpu
    memory            = var.app_runner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 3
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main[0].arn
    }
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.backend[0].arn

  depends_on = [
    aws_ecr_repository.backend,
    aws_elasticache_cluster.redis
  ]
}

resource "aws_apprunner_auto_scaling_configuration_version" "backend" {
  count = var.enable_app_runner ? 1 : 0

  auto_scaling_configuration_name = "${local.name_prefix}-backend-as"

  max_concurrency = 100
  max_size        = var.app_runner_max_size
  min_size        = var.app_runner_min_size

  tags = {
    Name = "${local.name_prefix}-backend-as"
  }
}
