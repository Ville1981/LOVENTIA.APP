// File: infra/terraform/variables.tf
// --- REPLACE START ---
variable "project" { type = string, description = "Project name (e.g., loventia)" }
variable "env"     { type = string, description = "Environment (staging|prod)" }
variable "region"  { type = string, default = "eu-north-1" }

variable "vpc_id"  { type = string }
variable "public_subnets"  { type = list(string) }
variable "private_subnets" { type = list(string) }

# Frontend (S3/CF)
variable "frontend_domain"    { type = string, default = "" } # optional custom CNAME like app.example.com
variable "hosted_zone_id"     { type = string, default = "" } # required only if using Route53 here
variable "cf_price_class"     { type = string, default = "PriceClass_100" }
variable "enable_waf"         { type = bool,   default = false }

# Backend (ECR/ECS)
variable "ecr_repo_name"      { type = string, default = "" }
variable "ecs_desired_count"  { type = number, default = 1 }
variable "task_cpu"           { type = number, default = 512 }
variable "task_memory"        { type = number, default = 1024 }
variable "container_port"     { type = number, default = 5000 }

# SSM param prefix (e.g. /loventia/staging)
variable "ssm_prefix"         { type = string, default = "" }

# Budgets (optional)
variable "enable_budget" { type = bool, default = false }
variable "budget_limit"  { type = number, default = 50 } # USD

// --- REPLACE END ---
