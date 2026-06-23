# Recursos App Runner retirados del código — no destruir en applies parciales.
# reconcile-state.sh también los saca del state en CI.

removed {
  from = aws_security_group.apprunner_connector

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_apprunner_vpc_connector.main

  lifecycle {
    destroy = false
  }
}
