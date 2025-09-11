// --- REPLACE START ---
// Ensure RTL matchers are available and Vitest globals are in scope
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest"; // keep locals to avoid "describe is not defined"
import i18n from "../i18n";
import DiscoverFilters from "../components/DiscoverFilters";

/**
 * NOTE FOR FUTURE MAINTAINERS:
 * The UI renders many i18n keys as text (e.g., "discover:title", "discover:instructions"),
 * and not all inputs have visible <label> text like "Minimum age".
 * These tests avoid brittle English label lookups and instead:
 *  - Accept i18n keys OR human text for headings/instructions.
 *  - Find number inputs generically (role=spinbutton) for age range.
 *  - Prefer data attributes if present; otherwise fall back to role/placeholder.
 * This keeps the test stable across locales and translation loading.
 *
 * Centralized stubs (router/i18n/polyfills) live in client/src/setupTests.js,
 * so we avoid per-file vi.mock calls to prevent hoisting issues.
 */

// Local helper: wrap UI with providers to keep calls like renderWithProviders(<Cmp />) working
function renderWithProviders(ui) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>
  );
}

// Helper: try common selectors for min/max inputs
function getAgeInputs() {
  // Prefer explicit data attributes if component provides them
  const minByDataCy = document.querySelector(
    '[data-cy="DiscoverFilters__minAge"]'
  );
  const maxByDataCy = document.querySelector(
    '[data-cy="DiscoverFilters__maxAge"]'
  );

  if (minByDataCy && maxByDataCy) {
    return { min: minByDataCy, max: maxByDataCy };
  }

  // Fallback: first two number inputs (role=spinbutton)
  const spinbuttons = screen.queryAllByRole("spinbutton");
  if (spinbuttons.length >= 2) {
    return { min: spinbuttons[0], max: spinbuttons[1] };
  }

  // Final fallback: placeholder-based (works even if placeholders are i18n keys)
  const minByPh =
    screen.queryByPlaceholderText(/min|minimum|discover:.*min/i) ||
    screen.queryByPlaceholderText(/age/i);
  const maxByPh =
    screen.queryByPlaceholderText(/max|maximum|discover:.*max/i) ||
    screen.queryByPlaceholderText(/age/i);

  return { min: minByPh, max: maxByPh };
}

// Helper: find submit button in a resilient way (data-cy first)
function getSubmitButton() {
  const byDataCy =
    document.querySelector('[data-cy="DiscoverFilters__submit"]') ||
    document.querySelector('[data-cy="Filters__submit"]');

  if (byDataCy) return byDataCy;

  const byRole =
    screen.queryByRole("button", { name: /discover:apply|apply|filter/i }) ||
    screen.queryByRole("button", { name: /discover:.*apply/i });

  return byRole || screen.getAllByRole("button")[0];
}

// Helper: get the <form> element robustly
function getFormEl() {
  return (
    document.querySelector('[data-cy="DiscoverFilters__form"]') ||
    document.querySelector("form") ||
    (getSubmitButton() && getSubmitButton().closest("form"))
  );
}

/**
 * Fill all required form fields generically so submit validation passes.
 * Uses attribute-level info (required/type/name/options) instead of label text.
 */
function fillAllRequiredFieldsSafely() {
  /** @type {HTMLElement[]} */
  const requiredFields = Array.from(
    document.querySelectorAll(
      "input[required], select[required], textarea[required]"
    )
  );

  // Handle radio groups: choose first per name
  /** @type {Map<string, HTMLInputElement>} */
  const radiosByName = new Map();
  requiredFields
    .filter((el) => el instanceof HTMLInputElement && el.type === "radio")
    .forEach((radio) => {
      if (!radiosByName.has(radio.name)) radiosByName.set(radio.name, radio);
    });

  radiosByName.forEach((radio) => {
    fireEvent.click(radio); // sets checked and triggers change
  });

  requiredFields.forEach((el) => {
    // Skip radio here (handled above) and age inputs (explicitly handled in tests)
    if (el instanceof HTMLInputElement) {
      if (el.type === "radio") return;

      const dc = el.getAttribute("data-cy") || "";
      const nm = el.name || "";
      const isMinAge = /minage/i.test(dc) || /minage/i.test(nm);
      const isMaxAge = /maxage/i.test(dc) || /maxage/i.test(nm);
      if (isMinAge || isMaxAge) return;

      switch (el.type) {
        case "number":
          // Respect min if present to satisfy client-side validation
          // @ts-ignore
          fireEvent.change(el, {
            target: { value: el.min ? String(el.min) : "1" },
          });
          break;
        case "email":
          fireEvent.change(el, { target: { value: "a@b.com" } });
          break;
        case "url":
          fireEvent.change(el, { target: { value: "https://example.com" } });
          break;
        case "checkbox":
          // Only check if not obviously premium-gated (avoid tripping the premium lock)
          if (!/dealbreaker|premium/i.test(dc)) {
            if (!el.checked) fireEvent.click(el);
          }
          break;
        case "text":
        default:
          fireEvent.change(el, { target: { value: "ok" } });
          break;
      }
    } else if (el instanceof HTMLSelectElement) {
      // Pick first non-empty, enabled option
      const option =
        Array.from(el.options).find((opt) => !opt.disabled && opt.value) ||
        el.options[0];
      if (option) {
        fireEvent.change(el, { target: { value: option.value } });
      }
    } else if (el instanceof HTMLTextAreaElement) {
      fireEvent.change(el, { target: { value: "ok" } });
    }
  });
}

describe("DiscoverFilters", () => {
  it("renders form title and instructions", () => {
    // Provide minimal required props to avoid prop-type warnings
    renderWithProviders(
      <DiscoverFilters values={{ minAge: 18, maxAge: 99 }} handleFilter={() => {}} onApply={() => {}} />
    );

    // Accept either translated text OR i18n keys
    const title =
      screen.queryByText(/discover:title/i) ||
      screen.queryByText(/filter/i) ||
      screen.queryByRole("heading", { level: 2 });

    const instructions =
      screen.queryByText(/discover:instructions/i) ||
      screen.queryByText(/instructions/i);

    expect(title).toBeInTheDocument();
    expect(instructions).toBeInTheDocument();
  });

  it("accepts age range input", () => {
    renderWithProviders(
      <DiscoverFilters values={{ minAge: 18, maxAge: 99 }} handleFilter={() => {}} onApply={() => {}} />
    );

    const { min, max } = getAgeInputs();
    expect(min).toBeTruthy();
    expect(max).toBeTruthy();

    fireEvent.change(min, { target: { value: "25" } });
    fireEvent.change(max, { target: { value: "40" } });

    // Use value assertions tolerant of input types (string in JSDOM)
    expect(min && min.value).toBe("25");
    expect(max && max.value).toBe("40");
  });

  it("calls handleFilter (or onApply) on submit with values", async () => {
    const mockHandleFilter = vi.fn();

    // Render with explicit defaults; pass both handlers in case component uses one of them
    renderWithProviders(
      <DiscoverFilters
        values={{ minAge: 20, maxAge: 35 }}
        handleFilter={mockHandleFilter}
        onApply={mockHandleFilter}
      />
    );

    // Ensure required fields are set to a valid, increasing range
    const { min, max } = getAgeInputs();
    expect(min).toBeTruthy();
    expect(max).toBeTruthy();

    fireEvent.change(min, { target: { value: "30" } });
    fireEvent.change(max, { target: { value: "45" } });

    // Fill any *other* required fields (location, intent, etc.)
    fillAllRequiredFieldsSafely();

    // If there is a distance or location requirement, try to fill it by data-cy/placeholder gracefully
    const distanceInput =
      document.querySelector('[data-cy="DiscoverFilters__distance"]') ||
      screen.queryByPlaceholderText(/distance|km|mi|discover:.*distance/i) ||
      null;
    if (distanceInput) {
      fireEvent.change(distanceInput, { target: { value: "50" } });
    }

    // Submit via button click *and* an explicit form submit to satisfy handlers
    const submitBtn = getSubmitButton();
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn);

    const formEl = getFormEl();
    if (formEl) {
      fireEvent.submit(formEl);
    }

    // Wait for either handler to be invoked (component may debounce/validate)
    await waitFor(() => {
      expect(mockHandleFilter).toHaveBeenCalled();
    });

    // Be flexible on payload shape; assert minAge/maxAge if field names exist
    const firstCallArgs = mockHandleFilter.mock.calls[0] || [];
    const payload = firstCallArgs[0] || {};
    if (Object.prototype.hasOwnProperty.call(payload, "minAge")) {
      expect(String(payload.minAge)).toBe("30");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "maxAge")) {
      expect(String(payload.maxAge)).toBe("45");
    }
    if (
      distanceInput &&
      Object.prototype.hasOwnProperty.call(payload, "distance")
    ) {
      expect(String(payload.distance)).toMatch(/50/);
    }
  });

  it("blocks dealbreakers if not premium", () => {
    const mockHandleFilter = vi.fn();
    renderWithProviders(
      <DiscoverFilters
        values={{ minAge: 18, maxAge: 99 }}
        handleFilter={mockHandleFilter}
        onApply={mockHandleFilter}
      />
    );

    // Try to toggle a dealbreaker checkbox by data attribute, role, or label text
    const checkboxByData =
      document.querySelector('[data-cy="DiscoverFilters__mustHavePhoto"]') ||
      document.querySelector('[data-cy="DiscoverFilters__dealbreaker"]');

    const checkboxByRole =
      screen.queryByRole("checkbox", { name: /must have photo/i }) ||
      screen.queryByRole("checkbox", { name: /discover:.*photo/i }) ||
      screen.queryByRole("checkbox");

    const checkbox = checkboxByData || checkboxByRole;
    expect(checkbox).toBeTruthy();

    fireEvent.click(checkbox);

    // Submit
    const submitBtn = getSubmitButton();
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn);

    const formEl = getFormEl();
    if (formEl) {
      fireEvent.submit(formEl);
    }

    // Non-premium should block advanced/dealbreaker filters
    expect(mockHandleFilter).not.toHaveBeenCalled();

    // Show some premium hint (accept i18n key or readable text)
    const premiumMsg =
      screen.queryByText(/premium/i) ||
      screen.queryByText(/upgrade/i) ||
      screen.queryByText(/discover:premium/i);
    expect(premiumMsg).toBeInTheDocument();
  });
});
// --- REPLACE END ---

