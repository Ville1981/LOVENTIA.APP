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
