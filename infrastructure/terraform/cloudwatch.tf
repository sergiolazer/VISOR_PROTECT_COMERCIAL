resource "aws_cloudwatch_log_group" "apprunner" {
  name              = "/aws/apprunner/${local.name_prefix}-backend"
  retention_in_days = 14
}

resource "aws_cloudwatch_metric_alarm" "apprunner_5xx" {
  count = var.enable_app_runner ? 1 : 0

  alarm_name          = "${local.name_prefix}-apprunner-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxStatusResponses"
  namespace           = "AWS/AppRunner"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Errores HTTP 4xx/5xx elevados en App Runner"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = aws_apprunner_service.backend[0].service_name
  }
}

resource "aws_cloudwatch_metric_alarm" "apprunner_latency" {
  count = var.enable_app_runner ? 1 : 0

  alarm_name          = "${local.name_prefix}-apprunner-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "RequestLatency"
  namespace           = "AWS/AppRunner"
  period              = 60
  extended_statistic  = "p95"
  threshold           = var.alert_latency_threshold_ms
  alarm_description   = "Latencia p95 del API supera ${var.alert_latency_threshold_ms}ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = aws_apprunner_service.backend[0].service_name
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.name_prefix}-redis-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "CPU Redis elevada — considerar escalar node_type"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis.cluster_id
  }
}
