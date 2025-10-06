// File: client/src/__tests__/DiscoverFilters.autoclose.test.jsx

// --- REPLACE START: robust selection (skip hidden/FormBasicInfo) + long-timer sweep (sync, no async/await) ---
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DiscoverFilters from "../components/DiscoverFilters.jsx";

/**
 * We flag any setTimeout >= 1000ms created while interacting with dropdowns.
 * Short debounces (<= 300ms) are allowed; long timers are typical culprits for “auto-close after a while”.
 */

const LABELS = [
  "Gender",
  "Orientation",
  "Country",
  "Region",
  "City",
  "Education",
  "Profession",
  "Religion",
  "Religion importance",
  "Political ideology",
  "Children",
  "Pets",
  "Lifestyle",
  "Smoking",
  "Alcohol",
  "Drugs",
  "Diet",
  "Exercise",
  "About",
  "Goals",
  "Searching for",
];

// Helper: is element inside a Tailwind “hidden” section or a FormBasicInfo block?
function isInHiddenOrFormBasicInfo(el) {
  let cur = el;
  while (cur) {
    const dc = cur.getAttribute?.("data-cy") || "";
    if (dc.includes("FormBasicInfo")) return true;
    const cls = cur.getAttribute?.("class") || "";
    if (/\bhidden\b/.test(cls)) return true; // Tailwind "hidden" class
    cur = cur.parentElement;
  }
  return false;
}

function findPreferredControl(scope, label) {
  const re = new RegExp(label, "i");
  const candidates = [
    ...scope.queryAllByRole("combobox", { name: re }),
    ...scope.queryAllByRole("button", { name: re }),
    ...scope.queryAllByLabelText(re),
    ...scope.queryAllByText(re),
  ];
  if (!candidates.length) return null;

  // Prefer elements NOT coming from hidden/FormBasicInfo subtree
  const preferred = candidates.find((el) => !isInHiddenOrFormBasicInfo(el));
  return preferred || candidates[0];
}

describe("DiscoverFilters dropdowns > no long auto-close timers", () => {
  it("opening dropdowns should not schedule timeouts >= 1000ms", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, "setTimeout");

    // Provide minimal yet valid props so the form renders
    const values = {
      minAge: 25,
      maxAge: 35,
      distanceKm: 0,
      country: "",
      region: "",
      city: "",
      customCountry: "",
      customRegion: "",
      customCity: "",
    };

    const { container } = render(
      <MemoryRouter>
        <DiscoverFilters values={values} handleFilter={() => {}} />
      </MemoryRouter>
    );

    const form = container.querySelector('[data-cy="DiscoverFilters__form"]') ?? container;
    const scope = within(form);

    // Try to open as many dropdowns as we can discover by their accessible names
    LABELS.forEach((label) => {
      const ctl = findPreferredControl(scope, label);
      if (!ctl) return; // not all labels exist in every variant

      ctl.focus?.();
      try {
        fireEvent.click(ctl);
      } catch {
        // If not clickable, ignore — we still observe timers created by other controls
      }
    });

    // Collect all scheduled delays (spy already captured them)
    const longTimers = spy.mock.calls
      .map((args) => Number(args?.[1]))
      .filter((delay) => Number.isFinite(delay) && delay >= 1000);

    spy.mockRestore();
    vi.useRealTimers();

    expect(
      longTimers,
      `Found ${longTimers.length} long timer(s) >=1000ms (likely auto-close). Delays: [${longTimers.join(", ")}]`
    ).toHaveLength(0);
  });
});
// --- REPLACE END ---
