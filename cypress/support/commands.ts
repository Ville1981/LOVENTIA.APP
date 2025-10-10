// File: client/cypress/support/commands.ts

// --- REPLACE START: Cypress custom commands for auth + test-id helpers (TypeScript) ---
/**
 * Lightweight auth helpers for E2E.
 * - loginAsTestUser(): registers (idempotent) and logs in, then seeds localStorage with the access token
 *   before your app loads, so axios/fetch in the app can read it immediately.
 * - logout(): clears tokens from storage.
 * - findByTestId(): minimal helper if @testing-library/cypress isn't installed.
 *
 * Conventions:
 * - Backend endpoints:
 *    POST /api/auth/register  -> { email, password }
 *    POST /api/auth/login     -> { email, password } → { token | accessToken }
 *    GET  /api/users/me       -> current user (optional)
 * - Storage key for the access token: "accessToken"
 *
 * You can override email/password via:
 *   - Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'), or
 *   - options passed to loginAsTestUser({ email, password })
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Registers (if needed) and logs in a test user.
       * Seeds window.localStorage["accessToken"] and optionally visits a page.
       */
      loginAsTestUser(options?: {
        email?: string;
        password?: string;
        /** Path to visit after seeding token; default "/" */
        path?: string;
        /** If false, do not cy.visit; just seed token in current window */
        visit?: boolean;
        /** If false, skip register step and only try login */
        register?: boolean;
      }): Chainable<{ token: string; email: string; userId?: string }>;

      /** Clears local storage token and cookies. */
      logout(): Chainable<void>;

      /** Minimal data-testid helper (if @testing-library/cypress is not installed). */
      findByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

export {};

function resolveTestCreds(opts?: { email?: string; password?: string }) {
  const fallbackEmail =
    Cypress.env('TEST_EMAIL') ||
    `e2e+${Date.now()}@example.com`;
  const fallbackPassword =
    Cypress.env('TEST_PASSWORD') || 'Passw0rd!234';

  return {
    email: (opts && opts.email) || fallbackEmail,
    password: (opts && opts.password) || fallbackPassword,
  };
}

/**
 * Tolerant register: treat 200/201 as success and 409 as "already exists".
 */
function tolerantRegister(email: string, password: string) {
  return cy
    .request({
      method: 'POST',
      url: '/api/auth/register',
      body: { email, password },
      failOnStatusCode: false,
    })
    .then((res) => {
      if (![200, 201, 409].includes(res.status)) {
        throw new Error(`Register failed (status ${res.status})`);
      }
    });
}

/**
 * Login and return token + (optionally) userId
 */
function login(email: string, password: string) {
  return cy
    .request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    })
    .then((res) => {
      const token = res.body?.token || res.body?.accessToken || res.body?.jwt;
      if (!token) throw new Error('No token in login response');
      return cy
        .request({
          method: 'GET',
          url: '/api/users/me',
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        })
        .then((me) => {
          const userId = me.status === 200 ? (me.body?._id || me.body?.id) : undefined;
          return { token, userId };
        });
    });
}

Cypress.Commands.add(
  'loginAsTestUser',
  (options?: {
    email?: string;
    password?: string;
    path?: string;
    visit?: boolean;
    register?: boolean;
  }) => {
    const { email, password } = resolveTestCreds(options);
    const shouldVisit = options?.visit !== false; // default true
    const path = options?.path || '/';
    const doRegister = options?.register !== false; // default true

    const chain = doRegister ? tolerantRegister(email, password) : cy.wrap(null);

    return chain
      .then(() => login(email, password))
      .then(({ token, userId }) => {
        if (shouldVisit) {
          // Seed token BEFORE app boots
          cy.visit(path, {
            onBeforeLoad(win) {
              try {
                win.localStorage.setItem('accessToken', token);
              } catch {
                // ignore storage errors in restricted contexts
              }
            },
          });
        } else {
          // Seed into current window instead of visiting
          cy.window().then((win) => {
            try {
              win.localStorage.setItem('accessToken', token);
            } catch {
              /* no-op */
            }
          });
        }

        // Expose auth info for subsequent tests
        const authInfo = { token, email, userId };
        cy.wrap(authInfo, { log: false }).as('auth');
        return authInfo;
      });
  }
);

Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    try {
      win.localStorage.removeItem('accessToken');
      // If your app stores additional auth keys, clear them here as well:
      // win.localStorage.removeItem('refreshToken');
    } catch {
      /* no-op */
    }
  });
  cy.clearCookies({ log: false });
});

/**
 * Minimal data-testid helper if Testing Library is not available.
 * If you already use @testing-library/cypress, you can remove this.
 */
Cypress.Commands.add(
  'findByTestId',
  { prevSubject: 'optional' },
  (subject: JQuery<HTMLElement> | undefined, testId: string) => {
    const selector = `[data-testid="${testId}"]`;
    return subject ? cy.wrap(subject).find(selector) : cy.get(selector);
  }
);
// --- REPLACE END ---
