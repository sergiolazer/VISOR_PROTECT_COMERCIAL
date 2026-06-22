# Fase 2 — App Runner y Go-Live

Guía para activar el backend en producción tras el bootstrap exitoso (fase 1).

## Estado actual (fase 1 completada)

| Recurso | Región | Estado |
|---------|--------|--------|
| ECR + imagen `:latest` | `sa-east-1` | Listo |
| VPC, Redis, S3, Secrets, IAM | `sa-east-1` | Listo |
| App Runner | — | No desplegado |
| `terraform-state` artifact | GitHub Actions | Persistido tras cada deploy en `main` |

## Limitación regional

**App Runner no existe en `sa-east-1`.** La fase 2 migra el stack Terraform a **`us-east-1`** (u otra región soportada). Al cambiar `AWS_REGION`, Terraform planificará **destruir** recursos en São Paulo y **crear** equivalentes en Virginia.

Impacto esperado:

- Nueva URL de ECR → el workflow volverá a hacer `docker push`.
- Nuevo Redis (caché vacía; aceptable para alertas).
- Nuevos secretos en Secrets Manager → **copiar valores** desde `sa-east-1` antes o justo después del apply.
- Recursos huérfanos en `sa-east-1` solo si el apply falla a medias — revisar consola AWS.

## Checklist previo

### 1. Secretos en AWS (región actual `sa-east-1`)

En [Secrets Manager](https://sa-east-1.console.aws.amazon.com/secretsmanager/) actualiza:

| Secreto | Formato |
|---------|---------|
| `visor-protect-production/mongo-uri` | Connection string MongoDB Atlas M10 |
| `visor-protect-production/jwt-secret` | String aleatorio ≥ 32 caracteres |
| `visor-protect-production/cloudinary` | JSON: `{"cloud_name":"...","api_key":"...","api_secret":"..."}` |

Guarda una copia local segura — los necesitarás de nuevo tras la migración a `us-east-1`.

### 2. MongoDB Atlas

- Cluster M10+ en región cercana a `us-east-1` (ej. `us-east-1` o `sa-east-1` con latencia aceptable).
- Network Access: permitir `0.0.0.0/0` durante bootstrap o IPs de salida de App Runner.
- Índices 2dsphere y TTL (el backend ejecuta `syncMongoIndexes()` al arrancar).

### 3. Frontend en producción

Despliega la Web App antes de fijar `CORS_ORIGIN`. Ver **[FRONTEND_DEPLOY.md](./FRONTEND_DEPLOY.md)**.

### 4. Variables GitHub (Settings → Actions → Variables)

| Variable | Valor fase 2 | Obligatorio |
|----------|--------------|-------------|
| `AWS_REGION` | `us-east-1` | Sí |
| `ENABLE_APP_RUNNER` | `true` | Sí |
| `CORS_ORIGIN` | URL del frontend, ej. `https://app.tudominio.com.br` | Sí — ver [FRONTEND_DEPLOY.md](./FRONTEND_DEPLOY.md) |
| `GITHUB_ORG` | Tu usuario/org (opcional si coincide con el repo) | No |
| `ECR_IMAGE_TAG` | `latest` | No |

### 5. Verificar artifact `terraform-state`

1. GitHub → **Actions** → último run de *Production Deploy* → **Artifacts**.
2. Debe existir `terraform-state` (retención 90 días).
3. En el log del job *Terraform*, busca:
   - `State restaurado desde artifact` (run ≥ 2), o
   - `Sin artifact terraform-state` (solo primer run).
4. Tras apply: `State persistido (serial=…, resource_instances=…)`.

> **Recomendación producción:** migrar a backend S3 remoto (ver `infrastructure/terraform/versions.tf`).

## Ejecutar fase 2

### Paso 1 — Exportar secretos (`sa-east-1`)

```bash
cd infrastructure/terraform
aws sts get-caller-identity   # verifica cuenta AWS

bash scripts/phase2-secrets.sh export ~/visor-protect-secrets-phase2.json
# Valida formato (mongodb+srv, JWT ≥32 chars, cloudinary JSON) — falla si hay placeholders
bash scripts/phase2-secrets.sh validate ~/visor-protect-secrets-phase2.json
```

O manualmente por consola: [Secrets Manager sa-east-1](https://sa-east-1.console.aws.amazon.com/secretsmanager/).

**Reglas de validación automática** (`export` / `validate` / `import`):

| Secreto | Formato exigido |
|---------|-----------------|
| `mongo-uri` | `mongodb://` o `mongodb+srv://…`, sin placeholder `REPLACE_*` |
| `jwt-secret` | ≥ 32 caracteres, no `change-me-in-production` ni placeholders |
| `cloudinary` | JSON con `cloud_name`, `api_key`, `api_secret` reales (no `REPLACE`) |

### Paso 2 — Desplegar frontend (obtener `CORS_ORIGIN`)

Guía completa: **[FRONTEND_DEPLOY.md](./FRONTEND_DEPLOY.md)**.

1. Conectar el repo en [Vercel](https://vercel.com) (usa `vercel.json` en la raíz).
2. Primer deploy → copiar URL, ej. `https://visor-protect-comercial.vercel.app`.
3. Esa URL será tu **`CORS_ORIGIN`** en el paso siguiente.

### Paso 3 — Variables GitHub

Solo continúa si `validate` terminó en **OK**.

**Settings → Secrets and variables → Actions → Variables**

| Variable | Valor |
|----------|-------|
| `AWS_REGION` | `us-east-1` |
| `ENABLE_APP_RUNNER` | `true` |
| `CORS_ORIGIN` | URL del **frontend** del paso 2 (sin `/` final) |

### Paso 4 — Disparar deploy

```bash
# Opción A: push vacío
git commit --allow-empty -m "chore: activar fase 2 App Runner"
git push origin main

# Opción B: GitHub → Actions → Production Deploy → Run workflow
```

Revisa el plan Terraform: destruye recursos en `sa-east-1` y crea en `us-east-1`.

### Paso 5 — Importar secretos (`us-east-1`)

Tras apply exitoso (secretos vacíos creados por Terraform):

```bash
bash infrastructure/terraform/scripts/phase2-secrets.sh import ~/visor-protect-secrets-phase2.json us-east-1
```

### Paso 6 — Verificar salud

URL en logs del job *Terraform* → output `app_runner_service_url`, o:

```bash
aws apprunner list-services --region us-east-1 \
  --query "ServiceSummaryList[?ServiceName=='visor-protect-production-backend'].ServiceUrl" \
  --output text

curl -s "https://<SERVICE_URL>/health" | jq .
```

Esperado: `"mongodb_connected": true`, `"alert_broker": "redis"`.

### Paso 7 — Frontend — apuntar al backend

Actualiza la URL del API en el frontend (no `CORS_ORIGIN`):

```env
VITE_API_URL=https://<SERVICE_URL>
```

Guarda `APP_RUNNER_SERVICE_ARN` en variables GitHub para redeploys manuales.

## Rollback

- Git revert del commit que activó fase 2 + push (redeploy imagen anterior si existe en ECR).
- O workflow manual *Redeploy App Only* con tag de imagen anterior.

## Limpieza `sa-east-1` (opcional)

Si el apply de fase 2 terminó bien, los recursos de fase 1 en `sa-east-1` deberían haberse destruido por Terraform. Revisa manualmente:

- ECR `visor-protect-backend`
- ElastiCache `visor-protect-production-redis`
- VPC `visor-protect-production-vpc`
- Secrets Manager `visor-protect-production/*`

Elimina manualmente cualquier recurso huérfano para evitar costos.
