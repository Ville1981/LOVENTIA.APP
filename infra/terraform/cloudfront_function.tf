resource "aws_cloudfront_function" "ua_filter" {
  name    = "${local.name}-ua-filter"
  runtime = "cloudfront-js-1.0"
  comment = "Simple UA filter for obvious bots"
  publish = true
  code    = file("${path.module}/../cloudfront/functions/ua-filter.js")
}
