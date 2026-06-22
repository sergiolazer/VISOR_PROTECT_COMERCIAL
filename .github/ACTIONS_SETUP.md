# GitHub Actions — Bootstrap en 2 fases

Configura en **Settings → Secrets and variables → Actions** antes del primer push a `main`.

Guía detallada fase 2: [docs/PHASE_2.md](../docs/PHASE_2.md)  
Frontend (CORS_ORIGIN): [docs/FRONTEND_DEPLOY.md](../docs/FRONTEND_DEPLOY.md)

## Secrets (Repository secrets)

| Nombre | Valor |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user con permisos Terraform + ECR + App Runner |
| `AWS_SECRET_ACCESS_KEY` | Secret correspondiente |

## Variables — Fase 1 (completada)

| Nombre | Valor | Notas |
|--------|-------|-------|
| `GITHUB_ORG` | *(opcional)* | Default: `github.repository_owner` |
| `CORS_ORIGIN` | *(opcional)* | Default bootstrap: `http://localhost:5173` |
| `ENABLE_APP_RUNNER` | `false` | Mantener hasta fase 2 |
| `AWS_REGION` | `sa-east-1` | ECR, Redis, VPC |
| `GITHUB_REPO` | *(opcional)* | Default: nombre del repositorio |
| `ECR_IMAGE_TAG` | `latest` | *(opcional)* |

## Variables — Fase 2 (App Runner)

| Nombre | Valor | Obligatorio |
|--------|-------|-------------|
| `AWS_REGION` | `us-east-1` | Sí — App Runner no existe en `sa-east-1` |
| `ENABLE_APP_RUNNER` | `true` | Sí |
| `CORS_ORIGIN` | `https://tu-frontend.com.br` | Sí |
| `APP_RUNNER_SERVICE_ARN` | ARN del servicio | Tras 2º apply (solo redeploy manual) |

> **Migración regional:** al pasar de `sa-east-1` a `us-east-1`, Terraform recrea el stack en Virginia. Copia los secretos de Secrets Manager antes del apply. Ver [PHASE_2.md](../docs/PHASE_2.md).

## Terraform state (artifact)

El workflow persiste `terraform.tfstate` como artifact `terraform-state` (90 días) tras cada deploy en `main`.

| Run | Log esperado |
|-----|----------------|
| Primero | `Sin artifact terraform-state` (normal) |
| Siguientes | `State restaurado desde artifact (serial=…)` |
| Tras apply | `State persistido (serial=…, resource_instances=…)` |

Verificar en GitHub → Actions → run → **Artifacts** → `terraform-state`.

Para producción a largo plazo, habilitar backend S3 en `infrastructure/terraform/versions.tf`.

## Flujo

1. **Fase 1** (`ENABLE_APP_RUNNER=false`, `AWS_REGION=sa-east-1`): ECR, Redis, S3, IAM; imagen en ECR.
2. Rellenar secretos en **AWS Secrets Manager** (`visor-protect-production/*`).
3. **Fase 2** (`ENABLE_APP_RUNNER=true`, `AWS_REGION=us-east-1`, `CORS_ORIGIN` real): App Runner + deploy automático.

Workflow: `.github/workflows/deploy.yml` (push a `main` o `workflow_dispatch`).
