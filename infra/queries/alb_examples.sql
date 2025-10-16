-- Top 5xx per path (viimeiset 7 pv)
WITH parsed AS (
  SELECT
    from_unixtime(parse_datetime(regexp_extract(timestamp, '([^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+)', 1), 'dd/MMM/yyyy:HH:mm:ss Z')) AS ts,
    elb_status_code,
    target_status_code,
    -- request: "GET https://example.com:443/path?qs HTTP/1.1"
    regexp_extract(request, '^[A-Z]+\\s+\\S+://[^/]+(\\/[^\\s?]*)', 1) AS path
  FROM alb_access_logs
  WHERE from_iso8601_timestamp(timestamp) >= current_timestamp - INTERVAL '7' day
)
SELECT path, count(*) AS errors
FROM parsed
WHERE (elb_status_code LIKE '5%' OR target_status_code LIKE '5%')
GROUP BY 1
ORDER BY errors DESC
LIMIT 50;

-- P95 vastausaika ALB:n omasta mittauksesta (response_processing_time) per päivä
SELECT
  date(from_iso8601_timestamp(timestamp)) AS day,
  approx_percentile(CAST(response_processing_time AS DOUBLE), 0.95) AS p95_resp
FROM alb_access_logs
WHERE from_iso8601_timestamp(timestamp) >= current_timestamp - INTERVAL '7' day
GROUP BY 1
ORDER BY 1;
