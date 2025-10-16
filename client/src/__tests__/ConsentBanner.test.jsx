import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";

// Korvaa oikea provider meidän mockilla
vi.mock("../components/ConsentProvider.jsx", () => import("./mocks/ConsentProvider.mock.jsx"));

// SUT
import ConsentBanner from "../components/ConsentBanner.jsx";
// Importoi tyyppi/signatuuri (mock korvaa toteutuksen)
import { ConsentProvider } from "../components/ConsentProvider.jsx";

const CONSENT_KEY = "consent.v1";

describe("ConsentBanner", () => {
  const wrapper = ({ children }) => <ConsentProvider>{children}</ConsentProvider>;

  beforeEach(() => {
    // JSDOM-ympäristön siivous + scrollTo-shim
    // eslint-disable-next-line no-undef
    window.scrollTo = window.scrollTo || vi.fn();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("shows banner when no decision, hides after Accept all", async () => {
    render(<ConsentBanner />, { wrapper });

    // näkyy aluksi
    const banner = await screen.findByTestId("consent-banner");
    expect(banner).toBeInTheDocument();

    // hyväksy kaikki
    await userEvent.click(screen.getByTestId("consent-accept"));

    // bannerin pitää kadota
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    // localStorage saa oikeat arvot
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({
      necessary: true,
      analytics: true,
      marketing: true,
    });
  });

  it("Reject non-essential sets analytics=false, marketing=false", async () => {
    render(<ConsentBanner />, { wrapper });

    // hylkää ei-välttämättömät
    await userEvent.click(await screen.findByTestId("consent-reject"));

    // bannerin pitää kadota
    await waitFor(() => {
      expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
    });

    // localStorage saa oikeat arvot
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "{}");
    expect(stored).toMatchObject({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });
});



