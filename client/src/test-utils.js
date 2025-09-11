// File: client/src/test-utils.js

// --- REPLACE START: test-time stubs & helpers (no Node fs, no dynamic imports) ---
/**
 * Lightweight helpers that run in Vitest's jsdom environment.
 * - Stubs for src/utils/abTest.js to avoid using Node 'fs' in tests.
 * - Add more test-only shims here if needed.
 *
 * How to activate:
 * 1) Recommended: add this file to Vitest `setupFiles`
 *    (in vitest.config.js or vite.config.js under test.setupFiles):
 *       setupFiles: ["client/src/setupTests.js", "client/src/test-utils.js"]
 * 2) Or import once from client/src/setupTests.js:
 *       import "./test-utils";
 */
import { vi } from "vitest";

/* -----------------------------------------------------------------------------
 * Stub: src/utils/abTest.js
 * Original module (CommonJS) reads from the filesystem. In jsdom tests we
 * replace it with in-memory data so Vitest workers don't attempt Node 'fs'.
 * ---------------------------------------------------------------------------*/

const __MOCK_AB_DATA__ = {
  experimentName: "default-exp",
  assignments: {
    control: ["user_a", "user_c", "user_e"],
    variantA: ["user_b", "user_d"],
  },
};

function __mock_loadAssignments(experimentName) {
  // If a test sets its own window.__AB_TEST_DATA__, prefer that
  const data =
    (typeof window !== "undefined" && window.__AB_TEST_DATA__) || __MOCK_AB_DATA__;
  if (data.experimentName !== experimentName) {
    throw new Error("Experiment not found");
  }
  return data.assignments;
}

function __mock_getUserVariant(experimentName, userId) {
  const assignments = __mock_loadAssignments(experimentName);
  for (const [variant, users] of Object.entries(assignments)) {
    if (users.includes(userId)) return variant;
  }
  // Deterministic fallback: distribute by string length or numeric modulo
  const variants = Object.keys(assignments);
  const idx =
    typeof userId === "string" ? userId.length % variants.length : Number(userId) % variants.length;
  return variants[idx];
}

const abTestMockModule = {
  loadAssignments: vi.fn(__mock_loadAssignments),
  getUserVariant: vi.fn(__mock_getUserVariant),
};

// Mock using common import IDs that may appear in the codebase/tests:
vi.mock("src/utils/abTest", () => ({ default: abTestMockModule, ...abTestMockModule }));
vi.mock("@src/utils/abTest", () => ({ default: abTestMockModule, ...abTestMockModule }));
vi.mock("@utils/abTest", () => ({ default: abTestMockModule, ...abTestMockModule }));

// Optional: expose helpers so tests can tweak data during runtime if needed.
if (typeof window !== "undefined") {
  window.__AB_TEST_DATA__ = __MOCK_AB_DATA__;
  window.__setAbTestData__ = (data) => {
    window.__AB_TEST_DATA__ = data;
    // Reset spies so expectations remain clear between tests
    abTestMockModule.loadAssignments.mockClear();
    abTestMockModule.getUserVariant.mockClear();
  };
}
// --- REPLACE END ---
