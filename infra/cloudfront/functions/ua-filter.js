function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var ua = (headers['user-agent'] && headers['user-agent'].value || '').toLowerCase();

  // Salli AWS Health Checkit ja tunnettujen crawlerien "hyvät" UA:t halutessa:
  // if (ua.includes('amazon cloudfront')) return request;

  var bad = [
    'curl', 'wget', 'python-requests', 'scrapy', 'httpclient',
    'libwww-perl', 'java', 'masscan', 'nikto', 'nessus'
  ];

  for (var i = 0; i < bad.length; i++) {
    if (ua.indexOf(bad[i]) !== -1) {
      return {
        statusCode: 403,
        statusDescription: 'Forbidden',
        headers: {
          'content-type': { value: 'text/plain; charset=utf-8' },
          'cache-control': { value: 'no-store' }
        },
        body: 'Forbidden'
      };
    }
  }
  return request;
}
