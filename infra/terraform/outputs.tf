output "s3_bucket_arn" {
  description = "The ARN of the example S3 bucket"
  value       = aws_s3_bucket.example.arn
}