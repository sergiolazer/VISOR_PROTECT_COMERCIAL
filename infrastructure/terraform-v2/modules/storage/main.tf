variable "project_name" { type = string }
variable "name_prefix" { type = string }
variable "account_id" { type = string }
variable "s3_chat_prefix" { type = string }
variable "tags" { type = map(string) }

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, { Component = "storage" })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_s3_bucket" "media" {
  provider = aws.s3
  bucket   = "${var.name_prefix}-media-${var.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.tags, {
    Component = "storage"
    DataClass = "critical"
  })
}

resource "aws_s3_bucket_public_access_block" "media" {
  provider                = aws.s3
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  provider = aws.s3
  bucket   = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  provider = aws.s3
  bucket   = aws_s3_bucket.media.id

  rule {
    id     = "chat-images-expire-7-days"
    status = "Enabled"

    filter {
      prefix = var.s3_chat_prefix
    }

    expiration {
      days = 7
    }
  }
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "s3_media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "s3_media_bucket_arn" {
  value = aws_s3_bucket.media.arn
}
