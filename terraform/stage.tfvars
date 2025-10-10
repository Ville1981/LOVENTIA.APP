project = "loventia"
env     = "stage"
region  = "eu-north-1"
domain  = "example.com"
subdomain_app = "staging"
subdomain_api = "api-staging"
desired_count = 1

block_cidrs = [
  "198.51.100.77/32",
  "198.51.100.0/24"
]
