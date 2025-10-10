// File: client/src/components/__tests__/ConsentBanner.test.jsx

// --- REPLACE START: Jest/RTL tests for ConsentBanner + ConsentProvider ---
/**
 * These tests work with Jest or Vitest (jsdom env).
 * Ensure your test runner uses a browser-like DOM (jsdom).
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsentProvider } from "../../components/ConsentProvider.jsx";
import ConsentBanner from "../../components/ConsentBanner.jsx";

const CONSENT_KEY = "consent.v1";

function renderWithProvider(ui) {
  return render(<ConsentProvider>{ui}</ConsentProvider>);
}

beforeEach(() => {
  // Clean slate before each test
  localStorage.removeItem(CONSENT_KEY);
});

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
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({ analytics: true, marketing: true, necessary: true });
    expect(typeof stored.timestamp).toBe("number");
  });

  test("Reject non-essential sets analytics=false, marketing=false", async () => {
    renderWithProvider(<ConsentBanner />);

    // Reject
    fireEvent.click(await screen.findByTestId("consent-reject"));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({ analytics: false, marketing: false, necessary: true });
  });

  test("Manage → Save choices (analytics on, marketing off)", async () => {
    renderWithProvider(<ConsentBanner />);

    // Open manage panel
    fireEvent.click(await screen.findByTestId("consent-manage"));

    // Turn analytics ON (it defaults true in component, but we toggle to be explicit)
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

    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({ analytics: true, marketing: false, necessary: true });
  });
});
// --- REPLACE END ---
