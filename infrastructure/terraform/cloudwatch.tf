resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count = local.enable_compute ? 1 : 0

  alarm_name          = "${local.name_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Errores HTTP 5xx elevados en ALB"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.backend[0].arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  count = local.enable_compute ? 1 : 0

  alarm_name          = "${local.name_prefix}-alb-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = var.alert_latency_threshold_ms / 1000
  alarm_description   = "Latencia p95 del API supera ${var.alert_latency_threshold_ms}ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.backend[0].arn_suffix
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
