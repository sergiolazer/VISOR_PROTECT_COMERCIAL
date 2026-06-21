resource "aws_s3_bucket" "media" {
  bucket = "${local.name_prefix}-media-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "chat-images-expire-7-days"
    status = "Enabled"

    filter {
      prefix = var.s3_chat_prefix
    }

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}
