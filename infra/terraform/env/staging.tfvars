# File: infra/terraform/env/staging.tfvars
# --- REPLACE START: minimal values to enable alarms in staging ---
project          = "loventia"
env              = "staging"

alarm_enable     = true
sns_topic_arn    = "arn:aws:sns:eu-north-1:REPLACE:loventia-staging-alarms"

ecs_cluster_name = "loventia-staging-cluster"
ecs_service_name = "loventia-staging-server"

alb_arn_suffix   = "app/loventia-staging-alb/xxxxxxxxxxxxxxxx"
tg_arn_suffix    = "targetgroup/loventia-staging-tg/yyyyyyyyyyyyyyyy"

alarm_cpu_high_threshold       = 80
alarm_mem_high_threshold       = 85
alarm_alb_5xx_threshold        = 10
alarm_tg_5xx_threshold         = 10
alarm_latency_p90_threshold_ms = 1500
alarm_period_seconds           = 60
alarm_evaluation_periods       = 3
# --- REPLACE END ---
