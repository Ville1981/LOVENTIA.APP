// PATH: server/src/swaggerSpec.js
// @ts-nocheck

// --- REPLACE START: unified, expanded Swagger/OpenAPI spec (auth + users + images) ---
/**
 * Swagger/OpenAPI spec for Loventia
 *
 * Goals for this file (matches your general instruction):
 * 1. Keep it ESM, keep top-level await (so you can read package.json like ennenkin).
 * 2. Do NOT shorten unnecessarily — we keep roughly same size, we just expand where needed.
 * 3. Add actual endpoints you juuri testasit PowerShellillä:
 *    - POST /api/auth/login   (primary)
 *    - POST /api/users/login  (legacy/fallback)
 *    - POST /api/auth/refresh
 *    - GET  /api/auth/me
 *    - GET  /api/users/me
 *    - POST /api/auth/forgot-password
 *    - POST /api/auth/reset-password
 *    - GET  /api/auth/private/ping
 *    - GET  /api/auth/private/no-me
 * 4. Add the image endpoints from the YAML you lähetit:
 *    - POST /api/profile/images
 *    - GET  /api/profile/images
 *    - DELETE /api/profile/images/{imageId}
 *    - POST /api/users/{userId}/upload-avatar
 * 5. Keep diagnostics (/health) here too so you see something even before routes are ready.
 * 6. Keep comments in English and mark change region clearly.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Try reading package.json starting from server/, then repo root.
 * This was in your previous minimal file — we keep it so version stays correct.
 */
async function readNearestPackageJson() {
  const candidates = [
    path.resolve(__dirname, '..', 'package.json'), // server/package.json
    path.resolve(__dirname, '..', '..', 'package.json'), // repo root package.json
  ];
  for (const p of candidates) {
    try {
      const buf = await readFile(p, 'utf8');
      return JSON.parse(buf);
    } catch {
      // continue
    }
  }
  return { name: 'loventia-app-server', version: '1.0.0' };
}

const pkg = await readNearestPackageJson();

/**
 * Base URL logic:
 * - your Express app mounts API at /api → http://localhost:5000/api
 * - we keep also the plain http://localhost:5000 to make /health visible
 */
const publicUrl = process.env.API_PUBLIC_URL || 'http://localhost:5000';
const apiBaseUrl = `${publicUrl.replace(/\/+$/, '')}/api`;

/**
 * Components reused across many endpoints
 */
const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  schemas: {
    // Basic user (self) as returned by /api/auth/me and /api/users/me
    Me: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '690767bbdc9075ce9f0034c6' },
        _id: { type: 'string', example: '690767bbdc9075ce9f0034c6' },
        email: { type: 'string', example: 'testuser1@example.com' },
        username: { type: 'string', example: 'Test User' },
        role: { type: 'string', example: 'user' },
        premium: { type: 'boolean', example: false },
        isPremium: { type: 'boolean', example: false },
        entitlements: {
          type: 'object',
          properties: {
            tier: { type: 'string', example: 'free' },
            features: {
              type: 'object',
              additionalProperties: true,
            },
            quotas: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        visibility: {
          type: 'object',
          properties: {
            isHidden: { type: 'boolean', example: false },
            hiddenUntil: { type: 'string', nullable: true },
            resumeOnLogin: { type: 'boolean', example: true },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    AuthSuccess: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful.' },
        user: { $ref: '#/components/schemas/Me' },
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
        expiresIn: { type: 'integer', example: 7200 },
      },
    },
    AuthError: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Invalid credentials' },
      },
    },
    RefreshResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        user: { $ref: '#/components/schemas/Me' },
      },
    },
    Image: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'img_123' },
        url: { type: 'string', example: '/uploads/user-1/avatar.png' },
        owner: { type: 'string', example: '690767bbdc9075ce9f0034c6' },
        is_profile_picture: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        uploaded: { type: 'string', format: 'date-time' },
      },
    },
  },
};

/**
 * Paths – this is the main part we expanded
 *
 * ALL endpoints below are documented as they are actually called from FE/PS:
 *  - /auth/*, /users/* are relative to /api because in app.js you did app.use('/api', routes)
 */
const paths = {
  // Diagnostics from previous minimal file
  '/health': {
    get: {
      summary: 'Liveness probe',
      tags: ['Diagnostics'],
      responses: {
        '200': { description: 'OK' },
      },
    },
  },
  '/api-docs': {
    get: {
      summary: 'Swagger UI (if enabled)',
      tags: ['Diagnostics'],
      responses: { '200': { description: 'Returns Swagger UI HTML' } },
    },
  },

  // =================
  // AUTH — MAIN FLOW
  // =================

  '/api/auth/login': {
    post: {
      summary: 'Login (primary)',
      description:
        'Primary login endpoint. FE tries this first. If it fails with 404/405, FE may try /api/users/login.',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', example: 'testuser1@example.com' },
                password: { type: 'string', example: 'Test1234!' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthSuccess' },
            },
          },
        },
        '400': {
          description: 'Invalid email or password',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthError' },
            },
          },
        },
      },
    },
  },

  '/api/users/login': {
    post: {
      summary: 'Login (legacy / fallback)',
      description:
        'Legacy/fallback login endpoint. Keep it documented so future devs see we support BOTH for now.',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string' },
                password: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthSuccess' },
            },
          },
        },
        '404': {
          description: 'Legacy login not mounted in this environment',
        },
      },
    },
  },

  '/api/auth/refresh': {
    post: {
      summary: 'Refresh access token',
      description:
        'This matches your PowerShell call: POST /api/auth/refresh { refreshToken: "..." } → returns new access token.',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: { type: 'string', description: 'JWT refresh token issued earlier' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'New access token issued',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshResponse' },
            },
          },
        },
        '401': { description: 'Invalid or expired refresh token' },
      },
    },
  },

  '/api/auth/me': {
    get: {
      summary: 'Get current user (auth router)',
      description:
        'Canonical “who am I” endpoint from the new auth router. This is the one we WANT people to use.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Current user profile',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Me' },
            },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },

  '/api/auth/logout': {
    post: {
      summary: 'Logout',
      description:
        'Stateless logout. You tested this: it returns "Logout successful" and token still works until expiry.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Logout successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { message: { type: 'string', example: 'Logout successful' } },
              },
            },
          },
        },
      },
    },
  },

  '/api/auth/forgot-password': {
    post: {
      summary: 'Request password reset email',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', example: 'testuser1@example.com' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Reset email sent (or at least not leaked)' },
        '400': { description: 'Invalid email' },
      },
    },
  },

  '/api/auth/reset-password': {
    post: {
      summary: 'Reset password with token',
      description:
        'Matches FE flow: POST /api/auth/reset-password { token, password, id? }. Returns success message.',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'password'],
              properties: {
                token: { type: 'string', description: 'Reset token from email link' },
                password: { type: 'string', format: 'password', minLength: 6 },
                id: {
                  type: 'string',
                  description: 'Optional user ID if backend expects it',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Password has been reset successfully.' },
        '400': { description: 'Token invalid or expired' },
      },
    },
  },

  '/api/auth/private/ping': {
    get: {
      summary: 'Auth private ping (diagnostics)',
      description:
        'You called this from PS and got `{ ok: true, router: "authPrivateRoutes" ... }`. Documented here so others can use it.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Private auth router is mounted.',
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },

  '/api/auth/private/no-me': {
    get: {
      summary: 'Explain /me placement',
      description:
        'This endpoint explicitly tells: “use /api/auth/me” — so we document it.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Explains why /me is not in this router.',
        },
      },
    },
  },

  // ============
  // USERS BLOCK
  // ============

  '/api/users/me': {
    get: {
      summary: 'Get current user (users router)',
      description:
        'You also called /api/users/me in PS and got SAME id. We document it here so the dual-source is clear.',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Current user profile from users router',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Me' },
            },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },

  // =============
  // IMAGES BLOCK
  // =============

  '/api/profile/images': {
    post: {
      summary: 'Upload a new user image',
      tags: ['Images'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Image uploaded successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Image' },
            },
          },
        },
        '400': { description: 'Bad request' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden - upload limit reached' },
        '415': { description: 'Unsupported Media Type' },
        '413': { description: 'Payload Too Large' },
      },
    },
    get: {
      summary: "List user's images",
      tags: ['Images'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of user images',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Image' },
              },
            },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    },
  },

  '/api/profile/images/{imageId}': {
    delete: {
      summary: 'Delete a user image',
      tags: ['Images'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'imageId',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '204': { description: 'Image deleted' },
        '401': { description: 'Unauthorized' },
        '404': { description: 'Image not found' },
      },
    },
  },

  '/api/users/{userId}/upload-avatar': {
    post: {
      summary: 'Upload a profile avatar for a user',
      tags: ['Images'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'userId',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the user uploading the image',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Image uploaded successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Image' },
            },
          },
        },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden - upload limit reached or wrong user' },
        '500': { description: 'Server error' },
      },
    },
  },
};

/**
 * Final spec object — this is what app.js uses
 */
const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Loventia API',
    description:
      'Full API surface for Loventia (auth, users, images, diagnostics). Generated from server/src/swaggerSpec.js. You can swap to YAML later.',
    version: pkg?.version || '1.0.0',
  },
  servers: [
    { url: publicUrl, description: 'Root (for /health etc.)' },
    { url: apiBaseUrl, description: 'API (app.use("/api", routes))' },
  ],
  tags: [
    { name: 'Diagnostics', description: 'Health and debugging helpers' },
    { name: 'Auth', description: 'Login, logout, refresh, forgot/reset' },
    { name: 'Users', description: 'User profile & self endpoints' },
    { name: 'Images', description: 'Image upload & management' },
  ],
  components,
  paths,
};

export default swaggerSpec;
// --- REPLACE END ---












