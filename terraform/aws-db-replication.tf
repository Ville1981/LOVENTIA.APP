// infra/terraform/aws-db-replication.tf

provider "aws" {
region = var.primary_region
}

variable "primary_region" {
description = "Primary AWS region"
type        = string
}

variable "replica_regions" {
description = "List of regions for read replicas"
type        = list(string)
}

resource "aws_db_instance" "primary" {
identifier         = "app-db-primary"
engine             = "mysql"
instance_class     = "db.t3.medium"
allocated_storage  = 20
name               = var.db_name
username           = var.db_user
password           = var.db_password
parameter_group_name = var.db_parameter_group
skip_final_snapshot = true
}

resource "aws_db_instance" "replicas" {
count              = length(var.replica_regions)
provider           = aws.replica[count.index]
identifier         = "app-db-replica-${var.replica_regions[count.index]}"
engine             = aws_db_instance.primary.engine
instance_class     = aws_db_instance.primary.instance_class
replicate_source_db= aws_db_instance.primary.arn
skip_final_snapshot = true
}

Define providers for each replica region

terraform {
required_providers {
aws = {
source  = "hashicorp/aws"
version = "~> 4.0"
}
}

required_version = ">= 1.0.0"
}

Dynamic provider aliases for replica regions

provider "aws" {
alias  = each.value
region = each.value
}

locals {
replica_providers = var.replica_regions
}

Create AWS providers for each replica region

data "aws_regions" "available" {
for_each = toset(local.replica_providers)
provider = aws
}