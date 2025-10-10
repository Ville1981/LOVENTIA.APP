# File: infra/terraform/cloudwatch_alarms.tf

# --- REPLACE START: CloudWatch alarms for ECS & ALB (conditional, minimal inputs) ---
terraform {
  required_version = ">= 1.4.0"
}

locals {
  env         = var.env
  project     = var.project
  name_prefix = "${var.project}-${var.env}"

  # Only create resources if enabled and mandatory inputs exist
  create_alarms = var.alarm_enable && var.sns_topic_arn != "" && var.ecs_cluster_name != "" && var.ecs_service_name != ""
}

# ECS Service CPU High Alarm
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  count               = local.create_alarms ? 1 : 0
  alarm_name          = "${local.name_prefix}-ecs-cpu-high"
  alarm_description   = "ECS service CPU > ${var.alarm_cpu_high_threshold}% for ${var.alarm_evaluation_periods * var.alarm_period_seconds}s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_cpu_high_threshold
  period              = var.alarm_period_seconds
  statistic           = "Average"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  treat_missing_data = "missing"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
}

# ECS Service Memory High
resource "aws_cloudwatch_metric_alarm" "ecs_mem_high" {
  count               = local.create_alarms ? 1 : 0
  alarm_name          = "${local.name_prefix}-ecs-mem-high"
  alarm_description   = "ECS service Memory > ${var.alarm_mem_high_threshold}% for ${var.alarm_evaluation_periods * var.alarm_period_seconds}s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_mem_high_threshold
  period              = var.alarm_period_seconds
  statistic           = "Average"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  treat_missing_data = "missing"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
}

# ALB 5XX Error Rate
resource "aws_cloudwatch_metric_alarm" "alb_5xx_high" {
  count               = local.create_alarms && var.alb_arn_suffix != "" ? 1 : 0
  alarm_name          = "${local.name_prefix}-alb-5xx-high"
  alarm_description   = "ALB 5XX too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_alb_5xx_threshold
  period              = var.alarm_period_seconds
  statistic           = "Sum"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  treat_missing_data = "notBreaching"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
}

# Target Group 5XX
resource "aws_cloudwatch_metric_alarm" "tg_5xx_high" {
  count               = local.create_alarms && var.tg_arn_suffix != "" ? 1 : 0
  alarm_name          = "${local.name_prefix}-tg-5xx-high"
  alarm_description   = "TargetGroup 5XX too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_tg_5xx_threshold
  period              = var.alarm_period_seconds
  statistic           = "Sum"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"

  dimensions = {
    TargetGroup = var.tg_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  treat_missing_data = "notBreaching"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
}

# Target Response Time p90
resource "aws_cloudwatch_metric_alarm" "tg_latency_p90_high" {
  count               = local.create_alarms && var.tg_arn_suffix != "" ? 1 : 0
  alarm_name          = "${local.name_prefix}-tg-latency-p90-high"
  alarm_description   = "Target response time p90 too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_latency_p90_threshold_ms / 1000
  period              = var.alarm_period_seconds
  extended_statistic  = "p90.00"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"

  dimensions = {
    TargetGroup = var.tg_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  treat_missing_data = "notBreaching"

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
}
# --- REPLACE END ---
