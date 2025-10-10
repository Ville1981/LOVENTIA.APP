// File: infra/terraform/acm.tf
// --- REPLACE START ---
# If you later want a custom certificate for CloudFront, define it in us-east-1 and wire into CF.
# This file includes only a placeholder as default is CF default cert.
# To enable, create aws_acm_certificate in provider aws.use1 and set viewer_certificate.acm_certificate_arn.
// --- REPLACE END ---
