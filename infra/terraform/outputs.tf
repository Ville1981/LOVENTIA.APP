# --- REPLACE START: helpful outputs (no secrets) ---
output "alarm_names" {
  description = "Created CloudWatch alarms"
  value = compact([
    try(aws_cloudwatch_metric_alarm.ecs_cpu_high[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.ecs_mem_high[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.alb_5xx_high[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.tg_5xx_high[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.tg_latency_p90_high[0].alarm_name, null),
  ])
}
# --- REPLACE END ---

# --- REPLACE START: helpful alarm outputs (append) ---
output "alb_arn_suffix_effective" {
  value       = local.alb_arn_suffix_effective
  description = "Effective ALB arn_suffix used by alarms"
}

output "tg_arn_suffix_effective" {
  value       = local.tg_arn_suffix_effective
  description = "Effective Target Group arn_suffix used by alarms"
}
# --- REPLACE END ---
