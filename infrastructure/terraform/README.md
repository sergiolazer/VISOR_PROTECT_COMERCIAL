# Terraform — Visor Protect Comercio (AWS)

Infraestructura como código en **`sa-east-1` (São Paulo)**:

- **ECR**, **ECS Fargate**, **ALB**
- **ElastiCache Redis**, **VPC** (subnets privadas + NAT + VPC endpoints)
- **S3** (lifecycle 7 días), **Secrets Manager**, **CloudWatch**, **OIDC GitHub**

MongoDB Atlas se gestiona fuera de Terraform; solo `MONGO_URI` en Secrets Manager.

> **No usar `us-east-1`** para este stack salvo migración planificada. App Runner (legacy) requería Virginia; **ECS corre en São Paulo**.

## Prerrequisitos

- Terraform >= 1.6
- AWS CLI (`aws configure`)
- Variables GitHub configuradas — ver [ACTIONS_SETUP.md](../../.github/ACTIONS_SETUP.md)

## CI/CD (recomendado)

Workflow `.github/workflows/deploy.yml` en push a `main`:

1. `npm run test:ci`
2. `infrastructure/terraform/scripts/pre-apply.sh` (bootstrap, plan, apply)
3. Docker → ECR → ECS rolling deploy

| Tipo | Nombre | Uso |
|------|--------|-----|
| Secret | `AWS_ACCESS_KEY_ID` | Terraform + deploy |
| Secret | `AWS_SECRET_ACCESS_KEY` | Terraform + deploy |
| Variable | `AWS_REGION` | **`sa-east-1`** |
| Variable | `ENABLE_ECS` | `true` en producción |
| Variable | `CORS_ORIGIN` | URL frontend (Vercel) |
| Variable | `GITHUB_ORG` | Org GitHub OIDC |

## Outputs útiles

| Output | Uso |
|--------|-----|
| `backend_service_url` | `VITE_API_URL` / `VITE_SOCKET_URL` en Vercel |
| `ecr_repository_url` | Push de imágenes Docker |
| `ecs_cluster_name` / `ecs_service_name` | Deploy y rollback |
| `redis_endpoint` | Debug (ECS usa env interno) |

## Secretos (antes de tráfico real)

En Secrets Manager **`sa-east-1`**:

1. `visor-protect-production/mongo-uri`
2. `visor-protect-production/jwt-secret`
3. `visor-protect-production/cloudinary`

Script: `bash scripts/phase2-secrets.sh` (desde raíz del repo).

## Apply local (solo debug)

```bash
cd infrastructure/terraform
export TF_VAR_github_org=sergiolazer
export TF_VAR_cors_origin=https://tu-frontend.vercel.app
export TF_VAR_enable_ecs=true
export TF_VAR_aws_region=sa-east-1
terraform init
bash scripts/pre-apply.sh   # o terraform plan/apply manual
```

## Referencias

- [PHASE_2.md](../../docs/PHASE_2.md)
- [FRONTEND_DEPLOY.md](../../docs/FRONTEND_DEPLOY.md)
