# File: infra/terraform/env/prod.tfvars
# --- REPLACE START: production values ---
project          = "loventia"
env              = "prod"

alarm_enable     = true
sns_topic_arn    = "arn:aws:sns:eu-north-1:REPLACE:loventia-prod-alarms"

ecs_cluster_name = "loventia-prod-cluster"
ecs_service_name = "loventia-prod-server"

alb_arn_suffix   = "app/loventia-prod-alb/aaaaaaaaaaaaaaaa"
tg_arn_suffix    = "targetgroup/loventia-prod-tg/bbbbbbbbbbbbbbbb"

alarm_cpu_high_threshold       = 75
alarm_mem_high_threshold       = 80
alarm_alb_5xx_threshold        = 5
alarm_tg_5xx_threshold         = 5
alarm_latency_p90_threshold_ms = 1200
alarm_period_seconds           = 60
alarm_evaluation_periods       = 3
# --- REPLACE END ---
