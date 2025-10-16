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


// File: client/scripts/generate-sitemap.mjs

// --- REPLACE START: minimal sitemap generator for SPA ---
// Generates client/public/sitemap.xml based on a static route list.
// Run manually: `node client/scripts/generate-sitemap.mjs`
// (Next step: I'll give you a tiny package.json script so it runs before build.)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Adjust to your canonical site URL (staging/prod swap can be done via env var)
const SITE_URL = process.env.SITE_URL || 'https://example.com';

// Minimal set of public routes; extend if needed
const ROUTES = [
  '/',               // Home / Landing
  '/discover',       // Discover
  '/subscriptions',  // Billing page
  '/privacy',        // Privacy Policy
  '/cookies',        // Cookie Policy
  '/terms',          // Terms (if you have it)
  '/login',
  '/register',
  // '/referral',    // add if enabled
];

const NOW = new Date().toISOString();

function buildUrlEntry(path) {
  const loc = new URL(path.replace(/^\//, ''), SITE_URL + '/').toString();
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${NOW}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.7'}</priority>
  </url>`;
}

const body = ROUTES.map(buildUrlEntry).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated: ${NOW} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

const outPath = resolve('client/public/sitemap.xml');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, xml, 'utf8');

console.log(\`[sitemap] wrote \${outPath} with \${ROUTES.length} routes\`);
// --- REPLACE END ---


// client/scripts/generate-sitemap.mjs
// --- REPLACE START: create sitemap generator ---
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const publicDir = path.join(repoRoot, 'public');
const outFile = path.join(publicDir, 'sitemap.xml');

// Ympäristö: PROD: SITEMAP_BASE_URL, fallback CLIENT_URL, dev: localhost
const baseUrl =
  process.env.SITEMAP_BASE_URL ||
  process.env.CLIENT_URL ||
  'http://localhost:5174';

// Lisää reittejä tarvittaessa (vain julkiset/indeksoitavat):
const routes = [
  '/',               // Etusivu
  '/discover',       // Discover
  '/profile',        // Oma profiili (jos julkinen perus-sivu)
  '/subscriptions',  // Tilaus
  // '/admin',       // Lisää vain jos haluat indeksoitavaksi
];

const today = new Date().toISOString().slice(0, 10);

const urlset = routes
  .map((r) => {
    const loc = new URL(r.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').toString();
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r === '/' ? '1.0' : '0.7'}</priority>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outFile, xml, 'utf8');

console.log(`[sitemap] Wrote ${path.relative(repoRoot, outFile)} with ${routes.length} routes`);
// --- REPLACE END ---


// client/scripts/generate-sitemap.mjs
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const publicDir = path.join(repoRoot, 'public');
const outFile = path.join(publicDir, 'sitemap.xml');

const baseUrl =
  process.env.SITEMAP_BASE_URL ||
  process.env.CLIENT_URL ||
  'http://localhost:5174';

// Lisää vain indeksoitavat reitit:
const routes = [
  '/',
  '/discover',
  '/profile',
  '/subscriptions',
  // '/admin', // lisää jos haluat indeksoitavaksi
];

const today = new Date().toISOString().slice(0, 10);

const urlset = routes
  .map((r) => {
    const loc = new URL(
      r.replace(/^\//, ''),
      baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    ).toString();
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r === '/' ? '1.0' : '0.7'}</priority>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outFile, xml, 'utf8');
console.log(`[sitemap] Wrote ${path.relative(repoRoot, outFile)} (${routes.length} routes)`);
