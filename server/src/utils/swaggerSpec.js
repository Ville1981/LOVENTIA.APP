// --- REPLACE START: minimal, safe Swagger spec (ESM) ---
/**
 * Minimal OpenAPI 3.0 spec used by Swagger UI.
 * - Keeps server boot resilient even if no authored spec exists yet.
 * - Reads version from nearest package.json (server-level preferred).
 * - You can later replace this with your generated spec; keep the default export name.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Try reading package.json starting from server/, then repo root */
async function readNearestPackageJson() {
  const candidates = [
    path.resolve(__dirname, '..', 'package.json'),      // server/package.json
    path.resolve(__dirname, '..', '..', 'package.json') // repo root package.json
  ];
  for (const p of candidates) {
    try {
      const buf = await readFile(p, 'utf8');
      return JSON.parse(buf);
    } catch {
      /* continue */
    }
  }
  return { name: 'loventia-app-server', version: '1.0.0' };
}

const pkg = await readNearestPackageJson();

/** NOTE: You can point this to staging/prod via ENV when serving docs */
const publicUrl = process.env.API_PUBLIC_URL || 'http://localhost:5000';

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Loventia API',
    description:
      'Auto-generated minimal OpenAPI spec for Swagger UI. Replace with your authored spec when ready.',
    version: pkg?.version || '1.0.0'
  },
  servers: [
    { url: publicUrl, description: 'Current API base URL' }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        tags: ['Diagnostics'],
        responses: {
          '200': {
            description: 'OK'
          }
        }
      }
    },
    '/api-docs': {
      get: {
        summary: 'Swagger UI',
        tags: ['Diagnostics'],
        responses: { '200': { description: 'Returns Swagger UI HTML' } }
      }
    }
  },
  tags: [
    { name: 'Diagnostics', description: 'Health and debugging helpers' }
  ]
};

export default swaggerSpec;
// --- REPLACE END ---
