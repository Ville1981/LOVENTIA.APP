// File: infra/terraform/outputs.tf
// --- REPLACE START ---
output "frontend_bucket" { value = aws_s3_bucket.frontend.id, description = "S3 bucket for SPA" }
output "cloudfront_domain" { value = try(aws_cloudfront_distribution.frontend.domain_name, null) }
output "ecr_repository_url" { value = try(aws_ecr_repository.server.repository_url, null) }
output "ecs_cluster_arn" { value = try(aws_ecs_cluster.this.arn, null) }
output "ecs_service_name" { value = try(aws_ecs_service.server.name, null) }
// --- REPLACE END ---
