# Plan de migración — inventario AWS (cuenta 634756923073, sa-east-1)

## Checklist de cutover

- [ ] **Fase A** — `modules/bootstrap`: crear bucket S3 + DynamoDB locks (apply manual, state local)
- [ ] **Fase B** — Configurar GitHub Variables: `TF_STATE_BUCKET`, `TF_STATE_LOCK_TABLE`
- [ ] **Fase C** — `terraform init` en `environments/production` con `backend.hcl`
- [ ] **Fase D** — Ejecutar `scripts/import-v2.sh` (o workflow **Terraform v2 (migrate)** con `apply=false`)
- [ ] **Fase E** — Revisar `terraform plan` — esperado: pocos `create` (ECS service, reglas SG, alarmas)
- [ ] **Fase F** — `TF_APPLY=true` o workflow con `apply=true`
- [ ] **Fase G** — Actualizar Vercel `VITE_API_URL` / `VITE_SOCKET_URL` si cambia ALB DNS
- [ ] **Fase H** — Cambiar `deploy.yml` `TF_WORKING_DIR` → v2 y desactivar artifact state
- [ ] **Fase I** — Eliminar VPC huérfana `vpc-0bf20c37978ae8d93`

---

## Red (modo migración)

En **v2** la red en `discover_existing_network=true` usa **data sources** (no import):

| Recurso | Método v2 |
|---------|-----------|
| VPC `vpc-05414285d00010eff` | `data.aws_vpc` tag `Name=visor-protect-production-vpc` |
| Subnets privadas/públicas | `data.aws_subnet` por **CIDR** en VPC ancla |

Opcional: `bash scripts/tag-network.sh` para tags `Tier` (no obligatorio con CIDR).

**No importar** VPC huérfana `vpc-0bf20c37978ae8d93`.

---

## Mapa import → direcciones módulo v2

Ejecutar desde `environments/production` tras `terraform init -backend-config=../../backend.hcl`.

Orden automático en `scripts/import-v2.sh`:

| # | Dirección Terraform | ID import |
|---|---------------------|-----------|
| 1 | `module.security.aws_iam_openid_connect_provider.github` | `arn:aws:iam::634756923073:oidc-provider/token.actions.githubusercontent.com` |
| 2 | `module.security.aws_secretsmanager_secret.mongo_uri` | `visor-protect-production/mongo-uri` |
| 3 | `module.security.aws_secretsmanager_secret.jwt_secret` | `visor-protect-production/jwt-secret` |
| 4 | `module.security.aws_secretsmanager_secret.cloudinary` | `visor-protect-production/cloudinary` |
| 5 | `module.storage.aws_s3_bucket.media` | `visor-protect-production-media-634756923073` |
| 6 | `module.storage.aws_ecr_repository.backend` | `visor-protect-backend` |
| 7 | `module.security.aws_iam_role.github_deploy` | `visor-protect-production-github-deploy` |
| 8 | `module.security.aws_iam_role_policy.github_deploy` | `visor-protect-production-github-deploy:visor-protect-production-github-deploy` |
| 9 | `module.database.aws_security_group.redis` | *(SG en VPC ancla — descubierto por CLI)* |
| 10 | `module.database.aws_elasticache_subnet_group.redis` | `visor-protect-production-redis` |
| 11 | `module.database.aws_elasticache_cluster.redis` | `visor-protect-production-redis` |
| 12+ | `module.security.aws_iam_role.ecs_*` | roles ECS si existen |
| 13+ | `module.compute[0].aws_lb.*` | ALB/TG/listener si existen |
| 14+ | `module.compute[0].aws_ecs_cluster.backend` | `visor-protect-production-backend` |
| — | `module.compute[0].aws_ecs_service.backend` | **Solo si ACTIVE** — si no, `apply` lo crea |

---

## Clasificación de recursos (qué NO puede caerse)

### Tier 0 — Protección estricta (`prevent_destroy` + backups)

| Recurso | Datos | Acción |
|---------|-------|--------|
| **MongoDB Atlas** | Usuarios, comercios, alertas | No tocar; backup Atlas |
| **Secrets Manager** (3) | URI, JWT, Cloudinary | Import |
| **S3 media** | Imágenes chat | Import |

### Tier 1 — Importar; downtime corto

| Recurso | Impacto si se recrea |
|---------|----------------------|
| ElastiCache Redis | Alertas en vivo ~1–5 min |
| VPC + subnets privadas | Redis depende de ellas — **no recrear** |

### Tier 2 — Recreables

ECS, ALB, NAT, SG compute, log groups, alarmas.

### Tier 3 — Eliminar

App Runner, VPC huérfana, SG `sg-0dbb342ef24119cb9`.

---

## Comandos locales

```bash
# 1. Bootstrap state (una vez)
cd infrastructure/terraform-v2/modules/bootstrap
terraform init
terraform plan -var="account_id=634756923073"
# terraform apply ...

# 2. Migración
cd ../../environments/production
cp ../../backend.hcl.example ../../backend.hcl   # editar bucket
terraform init -backend-config=../../backend.hcl
export TF_VAR_github_org=TU_ORG
export TF_VAR_cors_origin=https://tu-app.vercel.app
bash ../../scripts/import-v2.sh
bash ../../scripts/pre-apply-v2.sh                 # solo plan
TF_APPLY=true bash ../../scripts/pre-apply-v2.sh   # apply
```

## GitHub Actions

Workflow manual: **Terraform v2 (migrate)**

- `apply=false` → import + plan (recomendado primero)
- `apply=true` → apply del plan guardado

---

## Paneles de autoridades (roadmap)

Módulo futuro `modules/authority/`: API Gateway, Cognito, WAF.
