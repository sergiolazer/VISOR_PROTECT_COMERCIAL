# App Runner retirado en 717ae55 — sacar del state sin destroy en AWS.

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

removed {
  from = aws_apprunner_service.backend

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_apprunner_auto_scaling_configuration_version.backend

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_log_group.apprunner

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.apprunner_5xx

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.apprunner_latency

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_iam_role.apprunner_ecr_access

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_iam_role.apprunner_instance

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_iam_role_policy.apprunner_instance

  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_iam_role_policy_attachment.apprunner_ecr_access

  lifecycle {
    destroy = false
  }
}
