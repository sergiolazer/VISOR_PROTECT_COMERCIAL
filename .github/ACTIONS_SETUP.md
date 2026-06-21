# GitHub Actions — Bootstrap en 2 fases

Configura en **Settings → Secrets and variables → Actions** antes del primer push a `main`.

## Secrets (Repository secrets)

| Nombre | Valor |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user o rol con permisos Terraform + ECR + App Runner |
| `AWS_SECRET_ACCESS_KEY` | Secret correspondiente |

## Variables (Repository variables) — Push 1

| Nombre | Valor (fase 1) | Usado en |
|--------|----------------|----------|
| `GITHUB_ORG` | Tu org o usuario GitHub | `TF_VAR_github_org` |
| `CORS_ORIGIN` | URL del frontend (ej. `https://app.tudominio.com.br`) | `TF_VAR_cors_origin` |
| `ENABLE_APP_RUNNER` | `false` | `TF_VAR_enable_app_runner` |
| `GITHUB_REPO` | `VISOR_PROTECT_COMERCIAL` (opcional) | `TF_VAR_github_repo` |
| `ECR_IMAGE_TAG` | `latest` (opcional) | `TF_VAR_ecr_image_tag` |
| `AWS_REGION` | `sa-east-1` (opcional, redeploy manual) | deploy-production |

## Variables — Push 2 (activar App Runner)

| Nombre | Valor (fase 2) |
|--------|----------------|
| `ENABLE_APP_RUNNER` | `true` |
| `APP_RUNNER_SERVICE_ARN` | ARN del servicio (tras 2º apply; opcional para redeploy manual) |

## Flujo

1. **Push 1** (`ENABLE_APP_RUNNER=false`): Terraform crea ECR/Redis/S3; CI sube imagen Docker a ECR.
2. Rellenar secretos en **AWS Secrets Manager** (mongo-uri, jwt-secret, cloudinary).
3. **Push 2** (`ENABLE_APP_RUNNER=true`): Terraform crea App Runner; CI dispara deployment.

Workflow: `.github/workflows/deploy.yml` (automático en push a `main`).
