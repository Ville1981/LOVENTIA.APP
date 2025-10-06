// File: client/src/__tests__/DiscoverLocation.behavior.test.jsx

// --- REPLACE START: guard against long auto-close timers in DiscoverLocation ---
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DiscoverLocation from "../components/discoverFields/DiscoverLocation.jsx";

// NOTE: This test is intentionally conservative: it fails if DiscoverLocation
// schedules *long* timers (>= 1000 ms) that commonly cause "auto-close" UX.
// Short debounces (e.g. 100–300 ms) are allowed.

describe("DiscoverLocation > no long auto-close timers", () => {
  const noop = () => {};
  let spy;

  beforeEach(() => {
    vi.useFakeTimers();
    spy = vi.spyOn(global, "setTimeout");
  });

  afterEach(() => {
    spy?.mockRestore();
    vi.useRealTimers();
  });

  it("does not schedule timeouts >= 1000ms on mount / basic interactivity", () => {
    render(
      <DiscoverLocation
        country=""
        setCountry={noop}
        region=""
        setRegion={noop}
        city=""
        setCity={noop}
        customCountry=""
        setCustomCountry={noop}
        customRegion=""
        setCustomRegion={noop}
        customCity=""
        setCustomCity={noop}
      />
    );

    // Let any initial timers queue
    vi.runOnlyPendingTimers();

    // Collect "long" timers that typically drive unintended auto-close
    const longTimers = spy.mock.calls.filter((call) => {
      // setTimeout(fn, delay, ...)
      const delay = Number(call?.[1]);
      return Number.isFinite(delay) && delay >= 1000;
    });

    expect(longTimers, "Component should not schedule long auto-close timers").toHaveLength(0);
  });
});
// --- REPLACE END ---
