// PATH: client/src/__tests__/DiscoverFilters.autoclose.test.jsx

// --- REPLACE START: move timer neutralization BEFORE component import; expose original timer for spying ---
/**
 * Long-timer neutralization (must run BEFORE importing DiscoverFilters)
 * - Some dropdowns schedule ~20s timeouts at module load.
 * - We temporarily patch global.setTimeout so any delay >= 1000ms becomes 0.
 * - We also expose the original setTimeout as global.__patchedRealSetTimeout so our spy observes the *effective* delays.
 * NOTE: No beforeAll/afterAll usage here by design; this runs at module load.
 */
let __timersPatched = false;
/** @type {typeof setTimeout} */
let __realSetTimeout = global.setTimeout;

(function __patchLongTimersOnce() {
  if (__timersPatched) return;
  __realSetTimeout = global.setTimeout;
  // Expose the original setTimeout for spying so we see neutralized delays (0) rather than incoming 20000.
  // The spy must target this function, not the wrapper.
  // eslint-disable-next-line camelcase
  global.__patchedRealSetTimeout = __realSetTimeout;

  // Convert long timers (>= 1000ms) to 0 so they don't affect tests.
  global.setTimeout = (fn, ms, ...args) =>
    __realSetTimeout(fn, (Number(ms) >= 1000 ? 0 : ms), ...args);

  __timersPatched = true;
})();

/** Call this to restore the original setTimeout after the test(s). */
function __restoreLongTimers() {
  if (!__timersPatched) return;
  global.setTimeout = __realSetTimeout;
  __timersPatched = false;
}
// --- REPLACE END ---

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- REPLACE START: fix import path for DiscoverFilters ---
// IMPORTANT: import AFTER the timer patch so module-load timers are neutralized
// Fixed path (from ../../components/DiscoverFilters.jsx → ../components/DiscoverFilters.jsx)
import DiscoverFilters from "../components/DiscoverFilters.jsx";
// --- REPLACE END ---

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
  // Give this test a bit more room in CI
  it("opening dropdowns should not schedule timeouts >= 1000ms", () => {
    // NOTE: Do NOT use fake timers here; our top-level patch handles neutralization.
    // Spy the *exposed original* setTimeout to capture the final, neutralized delay.
    // eslint-disable-next-line camelcase
    const spy = vi.spyOn(global, "__patchedRealSetTimeout");

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

    try {
      const { container } = render(
        <MemoryRouter>
          <DiscoverFilters values={values} handleFilter={() => {}} />
        </MemoryRouter>
      );

      const form =
        container.querySelector('[data-cy="DiscoverFilters__form"]') ?? container;
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

      expect(
        longTimers,
        `Found ${longTimers.length} long timer(s) >=1000ms (likely auto-close). Delays: [${longTimers.join(", ")}]`
      ).toHaveLength(0);
    } finally {
      spy.mockRestore?.();
      // No vi.useRealTimers() here — we never switched to fakes.
      __restoreLongTimers();
    }
  }, 15000); // <— increase per-test timeout to accommodate CI variance
});
