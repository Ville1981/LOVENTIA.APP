// PATH: client/src/__tests__/ConsentBanner.test.jsx

// --- REPLACE START: Fix LS key reset + keep imports relative to src/__tests__ ----
/**
 * Jest/Vitest + jsdom tests for ConsentBanner + ConsentProvider
 * This file lives in `client/src/__tests__/`, so components are at `../components/*`.
 *
 * IMPORTANT:
 * - ConsentProvider persists to localStorage using the canonical key "loventia:consent".
 * - Clear BOTH legacy and canonical keys between tests to avoid cross-test bleed.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsentProvider } from "../components/ConsentProvider.jsx";
import ConsentBanner from "../components/ConsentBanner.jsx";
// --- REPLACE END ---

// Legacy key used by older tests (keep clearing for compatibility)
const LEGACY_CONSENT_KEY = "consent.v1";

// --- REPLACE START: align storage key(s) with ConsentProvider ---
/**
 * Canonical key used by ConsentProvider (must match client/src/components/ConsentProvider.jsx)
 * NOTE: we also clear a previous canonical variant to be safe across repo history.
 */
const CONSENT_KEY = "loventia:consent";
const OLD_CANONICAL_KEY = "loventia-consent-v1";
// --- REPLACE END ---

function renderWithProvider(ui) {
  return render(<ConsentProvider>{ui}</ConsentProvider>);
}

// --- REPLACE START: robust localStorage cleanup (all known keys) ---
function clearConsentStorage() {
  try {
    localStorage.removeItem(LEGACY_CONSENT_KEY);
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(OLD_CANONICAL_KEY);
  } catch {
    // ignore (jsdom/localStorage quirks)
  }
}

beforeEach(() => {
  // Clean slate before each test (all known keys)
  clearConsentStorage();
});

afterEach(() => {
  // Extra safety to avoid bleed between tests
  clearConsentStorage();
});
// --- REPLACE END ---

describe("ConsentBanner", () => {
  test("shows banner when no decision, hides after Accept all", async () => {
    renderWithProvider(<ConsentBanner />);

    // Banner visible initially
    const banner = await screen.findByTestId("consent-banner");
    expect(banner).toBeInTheDocument();

    // Accept all
    fireEvent.click(screen.getByTestId("consent-accept"));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    // LocalStorage should contain analytics/marketing true
    // --- REPLACE START: read canonical key + assert timestamp field correctly ---
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({
      analytics: true,
      marketing: true,
      necessary: true,
    });

    // ConsentProvider writes `timestamp` (number)
    expect(typeof stored.timestamp).toBe("number");
    expect(stored.timestamp).toBeGreaterThan(0);
    // --- REPLACE END ---
  });

  test("Reject non-essential sets analytics=false, marketing=false", async () => {
    renderWithProvider(<ConsentBanner />);

    // Reject
    fireEvent.click(await screen.findByTestId("consent-reject"));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    // --- REPLACE START: read canonical key ---
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({
      analytics: false,
      marketing: false,
      necessary: true,
    });
    expect(typeof stored.timestamp).toBe("number");
    // --- REPLACE END ---
  });

  test("Manage → Save choices (analytics on, marketing off)", async () => {
    renderWithProvider(<ConsentBanner />);

    // Open manage panel
    fireEvent.click(await screen.findByTestId("consent-manage"));

    // Turn analytics ON (toggle explicitly)
    const chkAnalytics = await screen.findByTestId("consent-chk-analytics");
    if (!chkAnalytics.checked) fireEvent.click(chkAnalytics);

    // Ensure marketing is OFF
    const chkMarketing = await screen.findByTestId("consent-chk-marketing");
    if (chkMarketing.checked) fireEvent.click(chkMarketing);

    // Save
    fireEvent.click(screen.getByTestId("consent-manage-save"));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    // --- REPLACE START: read canonical key ---
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({
      analytics: true,
      marketing: false,
      necessary: true,
    });
    expect(typeof stored.timestamp).toBe("number");
    // --- REPLACE END ---
  });
});
