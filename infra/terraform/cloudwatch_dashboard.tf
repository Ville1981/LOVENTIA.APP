# infra/terraform/cloudwatch_dashboard.tf
# --- REPLACE START: CloudWatch dashboard with ALB/ECS widgets ---
variable "dashboard_name" {
  type    = string
  default = "loventia-ops"
}

# Nimeä nämä variksi jos eivät jo ole:
# var.alb_arn_suffix, var.alb_tg_arn_suffix, var.ecs_cluster_name, var.ecs_service_name

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = var.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      # ALB requests
      {
        type = "metric",
        x = 0, y = 0, width = 12, height = 6,
        properties = {
          title = "ALB RequestCount (sum)"
          view  = "timeSeries"
          region = var.aws_region
          metrics = [
            [ "AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { "stat":"Sum" } ]
          ]
          period = 60
        }
      },
      # ALB 5xx count
      {
        type = "metric",
        x = 12, y = 0, width = 12, height = 6,
        properties = {
          title = "ALB HTTP 5xx (sum)"
          view  = "timeSeries"
          region = var.aws_region
          metrics = [
            [ "AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { "stat":"Sum" } ],
            [ ".", "HTTPCode_Target_5XX_Count", ".", ".", { "stat":"Sum" } ]
          ]
          period = 60
        }
      },
      # Target Healthy hosts
      {
        type = "metric",
        x = 0, y = 6, width = 12, height = 6,
        properties = {
          title = "Target HealthyHostCount"
          view  = "timeSeries"
          region = var.aws_region
          metrics = [
            [ "AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", var.alb_tg_arn_suffix, "LoadBalancer", var.alb_arn_suffix, { "stat":"Average" } ]
          ]
          period = 60
        }
      },
      # ECS CPU/Memory
      {
        type = "metric",
        x = 12, y = 6, width = 12, height = 6,
        properties = {
          title = "ECS Service CPU/Memory Utilization"
          view  = "timeSeries"
          region = var.aws_region
          metrics = [
            [ "AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { "stat": "Average" } ],
            [ ".", "MemoryUtilization", ".", ".", ".", ".", { "stat": "Average" } ]
          ]
          period = 60
        }
      }
    ]
  })
}
# --- REPLACE END ---
