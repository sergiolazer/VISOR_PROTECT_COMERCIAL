# Terraform v2 — Visor Protect Comercial

Reconstrucción modular con **backend remoto S3 + DynamoDB**, data sources por tags e import controlado del stack actual.

> **Estado:** planificación / scaffold. No reemplaza `infrastructure/terraform/` hasta completar la migración.

## Fases

| Fase | Acción | Estado |
|------|--------|--------|
| 0 | Scaffold módulos + backend.tf | ✅ Hecho |
| A | Bootstrap S3 + DynamoDB | Pendiente (manual) |
| B | import-v2.sh + plan | Pendiente |
| C | Apply v2 + cutover CI | Pendiente |
| D | Deprecar `terraform/` legacy | Pendiente |

Ver checklist completo en `docs/MIGRATION.md`.

## Layout

```
terraform-v2/
├── backend.tf              # Backend S3 (config vía backend.hcl)
├── versions.tf
├── providers.tf
├── variables.tf
├── locals.tf
├── outputs.tf
├── backend.hcl.example
├── terraform.tfvars.example
├── environments/production/main.tf
├── modules/
│   ├── bootstrap/          # State bucket + lock table (apply una vez)
│   ├── network/
│   ├── database/           # Redis + SG (Mongo = Atlas externo)
│   ├── compute/            # ECS Fargate + ALB
│   ├── security/           # IAM ECS + GitHub OIDC
│   ├── storage/            # S3 media + ECR
│   └── observability/      # CloudWatch alarms
└── docs/MIGRATION.md
```

## Comandos (cuando estés listo — no ejecutar apply sin revisar plan)

```bash
cd infrastructure/terraform-v2/modules/bootstrap
terraform init && terraform plan   # solo bucket + dynamodb

cd ../../environments/production
cp ../../backend.hcl.example backend.hcl   # editar nombres
terraform init -backend-config=backend.hcl
terraform plan -var-file=../../terraform.tfvars
```
