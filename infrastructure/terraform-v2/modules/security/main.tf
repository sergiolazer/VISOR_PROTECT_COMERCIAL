# IAM — least privilege para ECS + GitHub OIDC deploy.

variable "name_prefix" { type = string }
variable "github_org" { type = string }
variable "github_repo" { type = string }
variable "aws_region" { type = string }
variable "account_id" { type = string }
variable "secrets_arns" {
  type        = list(string)
  description = "Deprecated — usar ARNs internos del módulo"
  default     = []
}
variable "s3_media_bucket_arn" { type = string }
variable "ecs_cluster_arn" {
  type    = string
  default = null
}
variable "ecs_service_arn" {
  type    = string
  default = null
}
variable "tags" { type = map(string) }

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.tags, { Component = "security" })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.mongo_uri.arn,
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.cloudinary.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.tags, { Component = "security" })
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.name_prefix}-ecs-task"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.mongo_uri.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.cloudinary.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${var.s3_media_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.s3_media_bucket_arn
      },
    ]
  })
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.name_prefix}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = merge(var.tags, { Component = "security" })
}

# Least privilege: ECR push solo al repo del proyecto; ECS solo al cluster/service concretos.
resource "aws_iam_role_policy" "github_deploy" {
  name = "${var.name_prefix}-github-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/visor-protect-backend"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
        ]
        Resource = var.ecs_service_arn != null ? [var.ecs_service_arn] : ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeTasks",
          "ecs:ListTasks",
        ]
        Resource = "*"
        Condition = var.ecs_cluster_arn != null ? {
          ArnEquals = {
            "ecs:cluster" = var.ecs_cluster_arn
          }
        } : null
      },
    ]
  })
}

# Secrets Manager — Tier 0 (importar; no recrear valores)

resource "aws_secretsmanager_secret" "mongo_uri" {
  name                    = "${var.name_prefix}/mongo-uri"
  recovery_window_in_days = 7
  description             = "MongoDB Atlas URI (externo)"

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.tags, { Component = "security", DataClass = "critical" })
}

resource "aws_secretsmanager_secret_version" "mongo_uri" {
  secret_id     = aws_secretsmanager_secret.mongo_uri.id
  secret_string = "REPLACE_AFTER_IMPORT"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.name_prefix}/jwt-secret"
  recovery_window_in_days = 7

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.tags, { Component = "security", DataClass = "critical" })
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = "REPLACE_AFTER_IMPORT"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "cloudinary" {
  name                    = "${var.name_prefix}/cloudinary"
  recovery_window_in_days = 7

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.tags, { Component = "security", DataClass = "critical" })
}

resource "aws_secretsmanager_secret_version" "cloudinary" {
  secret_id     = aws_secretsmanager_secret.cloudinary.id
  secret_string = jsonencode({ cloud_name = "x", api_key = "x", api_secret = "x" })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "secrets_arns" {
  value = {
    mongo_uri  = aws_secretsmanager_secret.mongo_uri.arn
    jwt_secret = aws_secretsmanager_secret.jwt_secret.arn
    cloudinary = aws_secretsmanager_secret.cloudinary.arn
  }
}
