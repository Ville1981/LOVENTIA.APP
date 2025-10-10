// File: client/cypress/e2e/consent.e2e.cy.ts

// --- REPLACE START: Cypress E2E for consent banner ---
/**
 * Requires your app to mount <ConsentProvider><App/><ConsentBanner/></ConsentProvider>
 * and to render the banner until a decision is saved to localStorage key "consent.v1".
 */
describe("Consent banner", () => {
  const CONSENT_KEY = "consent.v1";

  beforeEach(() => {
    // Start from a clean state for each test
    cy.clearLocalStorage();
  });

  it("Accept all → stores consent (analytics=true, marketing=true) and hides banner", () => {
    cy.visit("/");

    cy.findByTestId("consent-banner").should("exist");
    cy.findByTestId("consent-accept").click();

    cy.findByTestId("consent-banner").should("not.exist");

    cy.window().then((win) => {
      const raw = win.localStorage.getItem(CONSENT_KEY);
      expect(raw, "consent.v1 exists").to.be.a("string");
      const parsed = JSON.parse(raw!);
      expect(parsed).to.include({ necessary: true, analytics: true, marketing: true });
      expect(parsed.timestamp).to.be.a("number");
    });
  });

  it("Reject non-essential → stores analytics=false, marketing=false", () => {
    cy.visit("/");

    cy.findByTestId("consent-banner").should("exist");
    cy.findByTestId("consent-reject").click();

    cy.findByTestId("consent-banner").should("not.exist");

    cy.window().then((win) => {
      const raw = win.localStorage.getItem(CONSENT_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed).to.include({ necessary: true, analytics: false, marketing: false });
    });
  });

  it("Manage → set granular choices and save", () => {
    cy.visit("/");

    cy.findByTestId("consent-manage").click();
    cy.findByTestId("consent-chk-analytics").as("chkA");
    cy.findByTestId("consent-chk-marketing").as("chkM");

    // Ensure analytics ON, marketing OFF
    cy.get("@chkA").then(($el) => {
      const input = $el[0] as HTMLInputElement;
      if (!input.checked) cy.wrap(input).click({ force: true });
    });
    cy.get("@chkM").then(($el) => {
      const input = $el[0] as HTMLInputElement;
      if (input.checked) cy.wrap(input).click({ force: true });
    });

    cy.findByTestId("consent-manage-save").click();

    cy.findByTestId("consent-banner").should("not.exist");

    cy.window().then((win) => {
      const raw = win.localStorage.getItem(CONSENT_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed).to.include({ necessary: true, analytics: true, marketing: false });
    });
  });

  it("Cookies page → Reset consent button clears and reloads", () => {
    // Pre-set some consent value
    cy.visit("/");
    cy.findByTestId("consent-accept").click();

    // Navigate to cookies page and reset
    cy.visit("/cookies");
    cy.findByTestId("reset-consent-button").click();

    // After reload, banner should appear again
    cy.findByTestId("consent-banner").should("exist");
  });
});
// --- REPLACE END ---
