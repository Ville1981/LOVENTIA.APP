terraform {
  required_version = ">= 1.6.0"
  backend "s3" {
    bucket = "REPLACE-tf-state-bucket"
    key    = "loventia/stage/terraform.tfstate"
    region = "eu-north-1"
    dynamodb_table = "REPLACE-tf-locks"
    encrypt = true
  }
}
