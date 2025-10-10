// File: client/scripts/i18n-assert.mjs

// --- REPLACE START: fail build if any locale misses keys ---
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve(process.cwd(), 'src', 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`[i18n-assert] No locale JSON files found in ${localesDir}`);
  process.exit(1);
}

const baseFile = files.find(f => /^en(\.|-|_)/i.test(f)) || files[0];
const base = JSON.parse(fs.readFileSync(path.join(localesDir, baseFile), 'utf8'));

function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(acc, flatten(v, key));
    } else {
      acc[key] = true;
    }
    return acc;
  }, {});
}

const baseMap = flatten(base);
let failed = false;

for (const f of files) {
  if (f === baseFile) continue;
  const data = JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8'));
  const map = flatten(data);

  const missing = Object.keys(baseMap).filter(k => !map[k]);
  if (missing.length) {
    failed = true;
    console.error(`\n[i18n-assert] Missing keys in ${f} (vs ${baseFile}):`);
    missing.slice(0, 50).forEach(k => console.error('  -', k));
    if (missing.length > 50) console.error(`  ...and ${missing.length - 50} more`);
  }
}

if (failed) {
  console.error('\n[i18n-assert] Failing due to missing i18n keys.');
  process.exit(1);
} else {
  console.log('[i18n-assert] All locales have complete keys.');
}
// --- REPLACE END ---
