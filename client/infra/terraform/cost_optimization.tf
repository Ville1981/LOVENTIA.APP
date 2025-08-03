// infra/terraform/cost_optimization.tf

provider "aws" {
  region = var.region
}

variable "instance_types" {
  type    = list(string)
  default = ["t3.micro", "t3.small"]
}

resource "aws_instance" "reserved" {
  count         = length(var.instance_types)
  ami           = var.server_ami
  instance_type = var.instance_types[count.index]

  lifecycle {
    purchase_option = "reserved"
    reserved_instance_opts {
      offering_class = "standard"
      tenancy        = "default"
      instance_count = 1
      offering_type  = "Partial Upfront"
    }
  }
}

resource "aws_spot_instance_request" "spot" {
  count               = var.spot_count
  ami                 = var.server_ami
  instance_type       = var.spot_type
  spot_price          = var.max_spot_price
  wait_for_fulfillment = true
}