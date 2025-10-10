// File: infra/terraform/ecs_cluster.tf
// --- REPLACE START ---
resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"
  setting { name = "containerInsights", value = "enabled" }
}
// --- REPLACE END ---
