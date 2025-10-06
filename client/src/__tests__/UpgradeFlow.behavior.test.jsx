// File: client/src/__tests__/UpgradeFlow.behavior.test.jsx

// --- REPLACE START: Upgrade CTA routes to /settings/subscriptions from DiscoverFilters ---
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DiscoverFilters from "../components/DiscoverFilters.jsx";

// Ensure user is non-premium by default
vi.mock("../utils/entitlements.js", async () => {
  const actual = await vi.importActual("../utils/entitlements.js");
  return { ...actual, isPremium: () => false };
});

// Auth is optional; DiscoverFilters handles undefined user, but we keep it stable:
vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: null, bootstrapped: true }),
}));

describe("Upgrade flow (CTA visibility + navigation)", () => {
  it("shows Upgrade CTA when dealbreakers are used by non-premium and navigates to subscriptions", async () => {
    const values = {
      // Age inputs valid so soft-submit is allowed
      minAge: 25,
      maxAge: 35,
      // Use any dealbreaker to trigger premium gate
      distanceKm: 10,
      // Location/basic fields can be empty; not required for this test
      country: "",
      region: "",
      city: "",
      customCountry: "",
      customRegion: "",
      customCity: "",
    };

    const handleFilter = vi.fn();

    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<DiscoverFilters values={values} setters={undefined} handleFilter={handleFilter} />}
          />
          <Route
            path="/settings/subscriptions"
            element={<div data-testid="subscriptions-page">Subscriptions Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Submit the form to trigger gating
    const form = container.querySelector('[data-cy="DiscoverFilters__form"]');
    expect(form).toBeTruthy();
    fireEvent.submit(form);

    // Expect the Upgrade CTA to be visible
    const cta = await screen.findByRole("link", { name: /Upgrade to Premium/i });
    expect(cta).toBeInTheDocument();

    // Click CTA -> should navigate to /settings/subscriptions
    fireEvent.click(cta);

    await waitFor(() => {
      expect(screen.getByTestId("subscriptions-page")).toBeInTheDocument();
    });

    // And since we were premium-gated, handleFilter should NOT have been called
    expect(handleFilter).not.toHaveBeenCalled();
  });
});
// --- REPLACE END ---
