// DB Replication Module

variable "source_region" {
  description = "Primary AWS region"
  type        = string
}

variable "replica_region" {
  description = "Secondary AWS region for read replica"
  type        = string
}

variable "db_identifier" {
  description = "Identifier of the source RDS instance"
  type        = string
}

variable "replica_identifier" {
  description = "Identifier for the new read replica"
  type        = string
}

provider "aws" {
  alias  = "source"
  region = var.source_region
}

provider "aws" {
  alias  = "replica"
  region = var.replica_region
}

resource "aws_db_instance" "read_replica" {
  provider               = aws.replica
  identifier             = var.replica_identifier
  replicate_source_db    = var.db_identifier
  instance_class         = "db.t3.medium"
  publicly_accessible    = false
  storage_encrypted      = true
  apply_immediately      = true
  auto_minor_version_upgrade = true

  tags = {
    Environment = "production"
    Role        = "read-replica"
  }
}

output "replica_endpoint" {
  description = "Endpoint address of the read replica"
  value       = aws_db_instance.read_replica.address
}