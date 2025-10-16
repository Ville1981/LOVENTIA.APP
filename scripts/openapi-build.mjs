// server/scripts/openapi-build.mjs
// --- REPLACE START: validate + bundle OpenAPI ---
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const spec = path.join(root, 'openapi', 'openapi.yaml');
const outDir = path.join(root, 'openapi', 'dist');

if (!fs.existsSync(spec)) {
  console.error(`[openapi] Spec not found: ${spec}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const run = (cmd) => {
  console.log(`[openapi] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  // Validate
  run(`npx --yes swagger-cli@4 validate "${spec}"`);
  // Bundle to JSON and YAML
  run(`npx --yes swagger-cli@4 bundle "${spec}" -o "${path.join(outDir,'openapi.bundled.json')}" -t json`);
  run(`npx --yes swagger-cli@4 bundle "${spec}" -o "${path.join(outDir,'openapi.bundled.yaml')}" -t yaml`);
  console.log(`[openapi] ✅ validate + bundle complete -> ${outDir}`);
} catch (err) {
  console.error('[openapi] ❌ validation/bundle failed');
  process.exit(1);
}
// --- REPLACE END ---
 

// server/scripts/openapi-build.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const spec = path.join(root, 'openapi', 'openapi.yaml');
const outDir = path.join(root, 'openapi', 'dist');

if (!fs.existsSync(spec)) {
  console.error(`[openapi] Spec not found: ${spec}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const run = (cmd) => { console.log(`[openapi] $ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

try {
  run(`npx --yes swagger-cli@4 validate "${spec}"`);
  run(`npx --yes swagger-cli@4 bundle "${spec}" -o "${path.join(outDir,'openapi.bundled.json')}" -t json`);
  run(`npx --yes swagger-cli@4 bundle "${spec}" -o "${path.join(outDir,'openapi.bundled.yaml')}" -t yaml`);
  console.log(`[openapi] ✅ validate + bundle complete -> ${outDir}`);
} catch (e) {
  console.error('[openapi] ❌ validation/bundle failed');
  process.exit(1);
}
