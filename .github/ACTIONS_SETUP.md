# GitHub Actions — Bootstrap en 2 fases

Configura en **Settings → Secrets and variables → Actions** antes del primer push a `main`.

Guía fase 2 (ECS Fargate): [docs/PHASE_2.md](../docs/PHASE_2.md)  
Frontend (CORS_ORIGIN): [docs/FRONTEND_DEPLOY.md](../docs/FRONTEND_DEPLOY.md)

## Secrets (Repository secrets)

| Nombre | Valor |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user con permisos Terraform + ECR + ECS |
| `AWS_SECRET_ACCESS_KEY` | Secret correspondiente |

## Variables — Fase 1

| Nombre | Valor | Notas |
|--------|-------|-------|
| `GITHUB_ORG` | *(opcional)* | Default: `github.repository_owner` |
| `CORS_ORIGIN` | *(opcional)* | Default bootstrap: `http://localhost:5173` |
| `ENABLE_ECS` | `false` | Mantener hasta fase 2 |
| `AWS_REGION` | `sa-east-1` | ECR, Redis, VPC, ECS |
| `GITHUB_REPO` | *(opcional)* | Default: nombre del repositorio |
| `ECR_IMAGE_TAG` | `latest` | *(opcional)* |

## Variables — Fase 2 (ECS Fargate + ALB)

| Nombre | Valor | Obligatorio |
|--------|-------|-------------|
| `ENABLE_ECS` | `true` | Sí |
| `CORS_ORIGIN` | URL del frontend (Vercel) | Sí |
| `AWS_REGION` | `sa-east-1` | Recomendado (ECS disponible) |
| `ECS_CLUSTER_NAME` | Tras apply (redeploy manual) | Opcional |
| `ECS_SERVICE_NAME` | Tras apply (redeploy manual) | Opcional |

`ENABLE_APP_RUNNER=true` es alias legacy de `ENABLE_ECS` (mismo efecto).

> **Región:** Usar siempre **`sa-east-1`**. No migrar a `us-east-1` (era requisito solo de App Runner, ya no usado).

## Terraform state (artifact)

El workflow persiste `terraform.tfstate` como artifact `terraform-state` (90 días).

## Flujo

1. **Fase 1** (`ENABLE_ECS=false`): ECR, Redis, S3, IAM; imagen en ECR.
2. Secretos en **Secrets Manager** + frontend en Vercel → `CORS_ORIGIN`.
3. **Fase 2** (`ENABLE_ECS=true`): ECS Fargate + ALB + deploy automático.

Workflow: `.github/workflows/deploy.yml`.
