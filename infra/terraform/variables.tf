# --- REPLACE START: variables for alarms (non-breaking; defaults keep disabled) ---
variable "project" { description = "Project slug (used in names)"; type = string; default = "loventia" }
variable "env"     { description = "Environment (staging|prod)"; type = string; default = "staging" }

variable "alarm_enable"     { description = "Enable CloudWatch alarms"; type = bool;   default = false }
variable "sns_topic_arn"    { description = "SNS Topic ARN for notifications"; type = string; default = "" }
variable "ecs_cluster_name" { description = "ECS Cluster name"; type = string; default = "" }
variable "ecs_service_name" { description = "ECS Service name"; type = string; default = "" }
variable "alb_arn_suffix"   { description = "ALB ARN suffix (app/xxx/yyy)"; type = string; default = "" }
variable "tg_arn_suffix"    { description = "TargetGroup ARN suffix (targetgroup/xxx/zzz)"; type = string; default = "" }

variable "alarm_cpu_high_threshold"  { description = "ECS CPU high threshold (%)"; type = number; default = 80 }
variable "alarm_mem_high_threshold"  { description = "ECS Memory high threshold (%)"; type = number; default = 85 }
variable "alarm_alb_5xx_threshold"   { description = "ALB 5xx count threshold per period"; type = number; default = 10 }
variable "alarm_tg_5xx_threshold"    { description = "TargetGroup 5xx count threshold per period"; type = number; default = 10 }
variable "alarm_latency_p90_threshold_ms" { description = "Latency p90 threshold (ms)"; type = number; default = 1200 }
variable "alarm_period_seconds"      { description = "Alarm period (seconds)"; type = number; default = 60 }
variable "alarm_evaluation_periods"  { description = "Number of periods"; type = number; default = 3 }
# --- REPLACE END ---

# --- REPLACE START: SNS + ALB/TG autodiscovery variables (append) ---
variable "create_sns_topic" {
  description = "Create SNS topic for alarms in this stack (otherwise pass an existing sns_topic_arn)"
  type        = bool
  default     = false
}

variable "sns_topic_name" {
  description = "Name for SNS topic if create_sns_topic=true"
  type        = string
  default     = "loventia-alarms"
}

variable "sns_topic_kms_key_arn" {
  description = "Optional CMK ARN for SNS server-side encryption"
  type        = string
  default     = null
}

variable "sns_topic_arn" {
  description = "Existing SNS topic ARN for alarms (ignored if create_sns_topic=true)"
  type        = string
  default     = null
}

variable "alb_name" {
  description = "ALB resource name to autodiscover arn_suffix (fallback if alb_arn_suffix is empty)"
  type        = string
  default     = null
}

variable "tg_name" {
  description = "Target Group name to autodiscover arn_suffix (fallback if tg_arn_suffix is empty)"
  type        = string
  default     = null
}

variable "alarm_emails" {
  description = "List of email addresses to subscribe to SNS alarms (requires create_sns_topic=true)"
  type        = list(string)
  default     = []
}

variable "enable_slack_alarm_forwarder" {
  description = "Create a Lambda subscriber that posts SNS messages to a Slack webhook (from SSM)"
  type        = bool
  default     = false
}

variable "slack_webhook_ssm_param" {
  description = "SSM parameter name that stores the Slack incoming webhook URL"
  type        = string
  default     = null
}
# --- REPLACE END ---


variable "aws_region" { type = string }
variable "alb_arn_suffix" { type = string }       # esim. app/my-alb/0123456789abcdef
variable "alb_tg_arn_suffix" { type = string }    # esim. targetgroup/my-tg/0123456789abcdef
variable "ecs_cluster_name" { type = string }
variable "ecs_service_name" { type = string }
variable "project" { type = string }


variable "amp_workspace_id" { type = string }
variable "aws_region"       { type = string }
variable "project"          { type = string }
