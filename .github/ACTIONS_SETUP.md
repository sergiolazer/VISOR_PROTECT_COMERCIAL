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
| `GITHUB_ORG` | Tu org o usuario GitHub **(opcional)** | `TF_VAR_github_org` — default: `github.repository_owner` |
| `CORS_ORIGIN` | URL del frontend **(opcional en fase 1)** | `TF_VAR_cors_origin` — default bootstrap: `http://localhost:5173` |
| `ENABLE_APP_RUNNER` | `false` | `TF_VAR_enable_app_runner` |
| `GITHUB_REPO` | Nombre del repo **(opcional)** | `TF_VAR_github_repo` — default: nombre del repositorio |
| `ECR_IMAGE_TAG` | `latest` (opcional) | `TF_VAR_ecr_image_tag` |
| `AWS_REGION` | `sa-east-1` (opcional, redeploy manual) | deploy-production |

> **Obligatorio antes del Push 2:** configura `CORS_ORIGIN` con la URL real del frontend cuando `ENABLE_APP_RUNNER=true`.

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
