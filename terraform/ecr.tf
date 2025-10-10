// File: infra/terraform/ecr.tf
// --- REPLACE START ---
resource "aws_ecr_repository" "server" {
  name                 = local.ecr_repo_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}
// --- REPLACE END ---
