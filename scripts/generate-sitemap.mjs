import { writeFileSync } from 'node:fs';
const base = process.env.SITEMAP_BASE_URL || 'https://app.example.com';

const routes = [
  '/', '/discover', '/chat', '/profile', '/subscriptions'
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(p => `  <url><loc>${base}${p}</loc></url>`).join('\n')}
</urlset>
`;

writeFileSync('public/sitemap.xml', xml);
console.log('sitemap.xml generated for', base);
