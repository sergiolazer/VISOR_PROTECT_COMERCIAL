# Terraform — Visor Protect Comercio (AWS)

Infraestructura como código para producción: **ECR**, **App Runner**, **ElastiCache Redis**, **S3** (lifecycle 7 días), **Secrets Manager**, **CloudWatch** y **OIDC para GitHub Actions**.

MongoDB Atlas (M10) se provisiona fuera de este módulo; solo se referencia vía `MONGO_URI` en Secrets Manager.

## Prerrequisitos

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6
- AWS CLI configurado (`aws configure`)
- Cluster MongoDB Atlas M10+ con índices 2dsphere y TTL (ver `docs/DATA_RETENTION.md`)

## Despliegue inicial

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars (github_org, cors_origin, etc.)

terraform init
terraform plan
terraform apply   # enable_app_runner=false — crea ECR, Redis, S3, secretos

# Push primera imagen (ver sección 5 de docs/DEPLOYMENT.md)

# En terraform.tfvars: enable_app_runner = true
terraform apply   # crea App Runner + alarmas
```

### CI/CD (GitHub Actions)

Workflow unificado `.github/workflows/deploy.yml` (push a `main`):

1. `npm run test:ci` (quality gate).
2. Terraform: `fmt` → `init` → `validate` → `plan` → `apply`.
3. Docker → ECR → App Runner (outputs de Terraform; sin secretos manuales de ARN).

| Tipo | Nombre | Uso |
|------|--------|-----|
| Secret | `AWS_ACCESS_KEY_ID` | Terraform + deploy app |
| Secret | `AWS_SECRET_ACCESS_KEY` | Terraform + deploy app |
| Variable | `GITHUB_ORG` | `TF_VAR_github_org` |
| Variable | `CORS_ORIGIN` | `TF_VAR_cors_origin` |
| Variable | `ENABLE_APP_RUNNER` | `false` bootstrap; `true` tras primera imagen |

Redeploy app sin IaC: workflow manual `.github/workflows/deploy-production.yml` (variable opcional `APP_RUNNER_SERVICE_ARN`).

Tras el primer `apply`, actualizar secretos en AWS Secrets Manager (no GitHub):

| Output Terraform | Acción |
|------------------|--------|
| `secrets_manager_arns` | Actualizar valores en consola AWS |
| `app_runner_service_url` | Verificar `GET /health` post-deploy |

## Secretos (obligatorio antes del tráfico real)

En AWS Secrets Manager, actualizar valores reales (Terraform ignora cambios posteriores):

1. `{prefix}/mongo-uri` — connection string Atlas
2. `{prefix}/jwt-secret` — secreto fuerte (32+ chars)
3. `{prefix}/cloudinary` — JSON con credenciales

## Primera imagen Docker

```bash
# Desde la raíz del monorepo
aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.sa-east-1.amazonaws.com

docker build -t visor-protect-backend .
docker tag visor-protect-backend:latest <ecr_url>:latest
docker push <ecr_url>:latest

aws apprunner start-deployment --service-arn <APP_RUNNER_SERVICE_ARN>
```

## Costos estimados (referencia)

| Recurso | Config por defecto | Nota |
|---------|-------------------|------|
| App Runner | 0.25 vCPU, min 1 | ~USD 5–15/mes base |
| ElastiCache | cache.t4g.micro | ~USD 12/mes |
| S3 + ECR | Lifecycle activo | Mínimo según uso |
| Atlas M10 | Externo | ~USD 57/mes |

Ajustar `app_runner_min_size=0` solo en staging (cold start ~10s).

## Destruir (solo staging)

```bash
terraform destroy
```

No ejecutar en producción sin backup de Atlas y secretos.
