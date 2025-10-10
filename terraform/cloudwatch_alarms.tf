// --- REPLACE START: baseline CloudWatch alarms for ECS/ALB ---
variable "project" { type = string }
variable "env"     { type = string }

# Expect these to be defined already in your stack (modules or root):
# - aws_ecs_cluster.main (or data source id)
# - aws_ecs_service.server (or service name via var)
# - aws_lb.app (ALB)
# - aws_lb_target_group.server_tg (TG)
# If names differ, adjust resource references below.

locals {
  alarm_prefix = "${var.project}-${var.env}"
}

# CPU > 80% for 5 minutes
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS service average CPU >= 80% for 5 mins"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.server.name
  }
}

# Memory > 80% for 5 minutes
resource "aws_cloudwatch_metric_alarm" "ecs_mem_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-mem-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS service average Memory >= 80% for 5 mins"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.server.name
  }
}

# ALB 5xx > 1% of requests over 5 mins
# Uses RequestCount & HTTPCode_ELB_5XX_Count
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "${local.alarm_prefix}-alb-5xx-rate"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  threshold           = 1
  treat_missing_data  = "notBreaching"
  metric_query {
    id          = "e1"
    expression  = "IF(m1>0, (m2/m1)*100, 0)"
    label       = "ALB 5xx %"
    return_data = true
  }
  metric_query {
    id = "m1"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_lb.app.arn_suffix
      }
    }
  }
  metric_query {
    id = "m2"
    metric {
      metric_name = "HTTPCode_ELB_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_lb.app.arn_suffix
      }
    }
  }
  alarm_description = "ALB 5xx >= 1% (5m)"
}

# TargetGroup 5xx count > 5 over 5 mins
resource "aws_cloudwatch_metric_alarm" "tg_5xx_count" {
  alarm_name          = "${local.alarm_prefix}-tg-5xx-count"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "TargetGroup 5xx >= 5 (5m)"
  dimensions = {
    TargetGroup  = aws_lb_target_group.server_tg.arn_suffix
    LoadBalancer = aws_lb.app.arn_suffix
  }
  treat_missing_data = "notBreaching"
}

# TargetGroup TargetResponseTime p95 > 1.5s (5 mins)
resource "aws_cloudwatch_metric_alarm" "tg_latency_p95" {
  alarm_name          = "${local.alarm_prefix}-tg-latency-p95"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  threshold           = 1.5
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  alarm_description   = "TargetGroup p95 latency >= 1.5s (5m)"
  dimensions = {
    TargetGroup  = aws_lb_target_group.server_tg.arn_suffix
    LoadBalancer = aws_lb.app.arn_suffix
  }
  treat_missing_data = "notBreaching"
}

# Optional: SNS topic for alarms (wire your email/Slack/ops)
# data "aws_iam_policy_document" ... (if you want)
# resource "aws_sns_topic" "alerts" { name = "${local.alarm_prefix}-alerts" }
# resource "aws_cloudwatch_metric_alarm" "...".alarm_actions = [aws_sns_topic.alerts.arn]
// --- REPLACE END ---






---

```hcl
# File: infra/terraform/cloudwatch_alarms.tf

# --- REPLACE START: CloudWatch alarms for ECS & ALB (conditional, minimal inputs) ---
terraform {
  required_version = ">= 1.4.0"
}

locals {
  env        = var.env
  project    = var.project
  name_prefix = "${var.project}-${var.env}"

  # Only create resources if enabled and mandatory inputs exist
  create_alarms = var.alarm_enable && var.sns_topic_arn != "" && var.ecs_cluster_name != "" && var.ecs_service_name != ""
}

# SNS topic is expected to exist (can be ChatOps or email). Pass ARN via tfvars.
# variable defs are in variables.tf patch below.

# ---------------------------
# ECS Service CPU High Alarm
# ---------------------------
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

# ---------------------------
# ECS Service Memory High
# ---------------------------
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

# ---------------------------
# ALB 5XX Error Rate (LoadBalancer)
# Requires: alb_arn_suffix (e.g., app/xxx/yyy)
# ---------------------------
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

# ---------------------------
# Target Group 5XX (from targets)
# Requires: tg_arn_suffix (e.g., targetgroup/xxx/zzz)
# ---------------------------
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

# ---------------------------
# ALB Target Response Time p90 (Latency)
# ---------------------------
resource "aws_cloudwatch_metric_alarm" "tg_latency_p90_high" {
  count               = local.create_alarms && var.tg_arn_suffix != "" ? 1 : 0
  alarm_name          = "${local.name_prefix}-tg-latency-p90-high"
  alarm_description   = "Target response time p90 too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_latency_p90_threshold_ms / 1000 # metric is in seconds
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
