# File: infra/terraform/env/prod.tfvars
# --- REPLACE START ---
project = "loventia"
env     = "prod"
region  = "eu-north-1"

vpc_id = "vpc-xxxxxxxx"
public_subnets  = ["subnet-aaa", "subnet-bbb"]
private_subnets = ["subnet-ccc", "subnet-ddd"]

frontend_domain = ""   # set if using Route53 here
hosted_zone_id  = ""

ecr_repo_name = "loventia/prod/server"
ssm_prefix    = "/loventia/prod"

ecs_desired_count = 2
task_cpu    = 512
task_memory = 1024
container_port = 5000

enable_waf   = false
enable_budget = true
budget_limit  = 100
# --- REPLACE END ---
