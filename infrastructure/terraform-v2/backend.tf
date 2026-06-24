# Backend remoto — obligatorio en producción.
#
# El bucket y la tabla DynamoDB se crean UNA VEZ con modules/bootstrap
# (state local). Luego este backend apunta a esos recursos.
#
# Inicialización:
#   terraform init -backend-config=backend.hcl
#
# backend.hcl (no commitear si contiene nombres sensibles de cuenta):
#   bucket         = "visor-protect-terraform-state-634756923073"
#   key            = "production/terraform.tfstate"
#   region         = "sa-east-1"
#   encrypt        = true
#   dynamodb_table = "visor-protect-terraform-locks"
#   use_lockfile   = true

terraform {
  backend "s3" {
    # Valores inyectados vía -backend-config=backend.hcl
  }
}
