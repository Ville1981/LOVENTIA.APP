// --- REPLACE START: billing endpoints happy-path tests with ESM-safe mocks ---
/**
 * These tests verify:
 *  1) POST /api/billing/portal returns { url }
 *  2) POST /api/billing/create-portal-session (legacy alias) returns { url }
 *  3) POST /api/billing/sync returns 200 and a JSON body (expects { ok: true, ... })
 *
 * They mock the Stripe layer and billing URLs, so no real network calls are made.
 * The replacement region is marked between // --- REPLACE START and // --- REPLACE END
 * so you can verify exactly what changed.
 */

import request from "supertest";
import jwt from "jsonwebtoken";

// Ensure NODE_ENV=test for app.js test-mode behaviors
process.env.NODE_ENV = "test";
// Provide a stable JWT secret that matches the test fallback inside app.js
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";

/**
 * ESM-friendly module mocks.
 * We mock the config modules used by the billing routes so the app can create
 * portal/sync behavior without touching real Stripe.
 */
jest.unstable_mockModule("../src/config/stripe.js", () => {
  // Minimal fake Stripe client used by payment/billing routes
  const fakeStripe = {
    billingPortal: {
      sessions: {
        create: async ({ customer }) => ({
          url: `https://billing.stripe.test/session/${customer || "cus_fake"}`,
        }),
      },
    },
    // Some sync flows may call these; return harmless defaults
    customers: {
      retrieve: async (id) => ({ id }),
    },
    subscriptions: {
      list: async () => ({ data: [] }),
    },
    paymentMethods: {
      list: async () => ({ data: [] }),
    },
    // If your code calls other pieces, add minimal stubs above.
  };

  return {
    // Do nothing; just avoid throwing NO_STRIPE_KEY
    assertStripeKey: () => {},
    // Always return the fake client
    getStripe: async () => fakeStripe,
    // Provide a test price id in case code reads it
    stripePriceId: "price_test_123",
  };
});

// Some implementations read a centralized return URL from here.
// We give a stable value so portal tests are deterministic.
jest.unstable_mockModule("../src/config/billingUrls.js", () => {
  return {
    billingUrls: {
      returnUrl: "https://app.test/settings/subscriptions",
    },
    getClientUrl: () => "https://app.test",
  };
});

// Import the app AFTER mocks are set up.
const { default: app } = await import("../src/app.js");

// Helper: create a valid Bearer token recognized by test auth in app.js
function makeToken(payload = {}) {
  const base = {
    userId: "507f1f77bcf86cd799439011",
    role: "user",
  };
  const claims = { ...base, ...payload };
  const secret = process.env.JWT_SECRET || "test_secret";
  return jwt.sign(claims, secret, { expiresIn: "1h" });
}

describe("Billing routes", () => {
  const AUTH = () => `Bearer ${makeToken()}`;
  const customerId = "cus_test_123";

  test("POST /api/billing/portal → 200 and returns { url }", async () => {
    const res = await request(app)
      .post("/api/billing/portal")
      .set("Authorization", AUTH())
      .send({ customerId });

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(typeof res.body.url).toBe("string");
    expect(res.body.url).toContain("https://billing.stripe.test/session/");
  });

  test("POST /api/billing/create-portal-session (alias) → 200 and returns { url }", async () => {
    const res = await request(app)
      .post("/api/billing/create-portal-session")
      .set("Authorization", AUTH())
      .send({ customerId });

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(typeof res.body.url).toBe("string");
    expect(res.body.url).toContain("https://billing.stripe.test/session/");
  });

  test("POST /api/billing/sync → 200 and returns JSON with ok flag", async () => {
    const res = await request(app)
      .post("/api/billing/sync")
      .set("Authorization", AUTH())
      .send({ customerId });

    expect(res.status).toBe(200);
    // Don't over-specify the shape; just ensure it's JSON and includes ok
    expect(res.body).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(res.body, "ok")).toBe(true);
  });
});
// --- REPLACE END ---
