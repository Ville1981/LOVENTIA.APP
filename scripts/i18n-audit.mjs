import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseDir = join(process.cwd(), 'public', 'locales');
const langs = readdirSync(baseDir).filter(x => !x.startsWith('.'));
const namespaces = new Set();

// read en as source (fallback)
const en = 'en';
const enDir = join(baseDir, en);
readdirSync(enDir).forEach(f => namespaces.add(f));

let missing = [];
for (const lang of langs) {
  if (lang === en) continue;
  for (const ns of namespaces) {
    const enObj = JSON.parse(readFileSync(join(enDir, ns), 'utf8'));
    let obj;
    try {
      obj = JSON.parse(readFileSync(join(baseDir, lang, ns), 'utf8'));
    } catch { missing.push(`${lang}/${ns}: file missing`); continue; }
    const walk = (a, b, path=[]) => {
      for (const k of Object.keys(a)) {
        if (!(k in b)) missing.push(`${lang}/${ns}: ${[...path,k].join('.')}`);
        else if (typeof a[k] === 'object') walk(a[k], b[k], [...path,k]);
      }
    };
    walk(enObj, obj);
  }
}

if (missing.length) {
  console.error('Missing i18n keys:\n' + missing.map(x => ' - ' + x).join('\n'));
  process.exit(1);
} else {
  console.log('i18n audit OK');
}



// client/scripts/i18n-audit.mjs
// --- REPLACE START: i18n audit script ---
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve('public', 'locales'); // run from /client
const baseLang = 'en';

// flatten nested keys to dot.notation
const flatten = (obj, prefix = '') => Object.entries(obj ?? {}).reduce((acc, [k, v]) => {
  const p = prefix ? `${prefix}.${k}` : k;
  if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v, p));
  else acc[p] = true;
  return acc;
}, {});

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const langs = fs.readdirSync(localesDir)
  .filter((f) => fs.statSync(path.join(localesDir, f)).isDirectory());

if (!langs.includes(baseLang)) {
  console.error(`[i18n-audit] Base language '${baseLang}' not found under ${localesDir}`);
  process.exit(1);
}

const namespaces = fs.readdirSync(path.join(localesDir, baseLang))
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json'));

let missingCount = 0;
for (const lang of langs) {
  if (lang === baseLang) continue;

  for (const ns of namespaces) {
    const basePath = path.join(localesDir, baseLang, `${ns}.json`);
    const targetPath = path.join(localesDir, lang, `${ns}.json`);

    if (!fs.existsSync(targetPath)) {
      console.error(`[i18n-audit] ${lang}/${ns}.json MISSING (base has it)`);
      missingCount++;
      continue;
    }

    const baseKeys = Object.keys(flatten(readJson(basePath)));
    const targetKeysObj = flatten(readJson(targetPath));
    const missingKeys = baseKeys.filter((k) => !targetKeysObj[k]);

    if (missingKeys.length) {
      missingCount += missingKeys.length;
      console.error(`\n[i18n-audit] Missing keys in ${lang}/${ns}.json (${missingKeys.length}):`);
      // show up to 50 to keep CI logs readable
      missingKeys.slice(0, 50).forEach((k) => console.error(`  - ${k}`));
      if (missingKeys.length > 50) console.error(`  ...and ${missingKeys.length - 50} more`);
    }
  }
}

if (missingCount > 0) {
  console.error(`\n[i18n-audit] ❌ Found ${missingCount} missing translation keys.`);
  process.exit(1);
}
console.log('[i18n-audit] ✅ All translation keys present across locales.');
// --- REPLACE END ---
