resource "aws_secretsmanager_secret" "mongo_uri" {
  name                    = "${local.name_prefix}/mongo-uri"
  recovery_window_in_days = 7
  description             = "MongoDB Atlas connection string (M10+). Actualizar valor manualmente tras crear cluster."
}

resource "aws_secretsmanager_secret_version" "mongo_uri" {
  secret_id     = aws_secretsmanager_secret.mongo_uri.id
  secret_string = "REPLACE_WITH_MONGODB_ATLAS_URI"

  lifecycle {
    # Valor real solo en consola/CLI — nunca re-aplicar placeholder tras el bootstrap.
    ignore_changes = all
  }
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}/jwt-secret"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = "REPLACE_WITH_STRONG_JWT_SECRET"

  lifecycle {
    ignore_changes = all
  }
}

resource "aws_secretsmanager_secret" "cloudinary" {
  name                    = "${local.name_prefix}/cloudinary"
  recovery_window_in_days = 7
  description             = "JSON: { cloud_name, api_key, api_secret }"
}

resource "aws_secretsmanager_secret_version" "cloudinary" {
  secret_id = aws_secretsmanager_secret.cloudinary.id
  secret_string = jsonencode({
    cloud_name = "REPLACE"
    api_key    = "REPLACE"
    api_secret = "REPLACE"
  })

  lifecycle {
    ignore_changes = all
  }
}
