// File: client/cypress/e2e/referral.e2e.cy.ts

// --- REPLACE START: Referral smoke (copy/share link & cookie attribution) ---
describe('Referral – smoke', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    // Requires your helper from support/commands.ts
    // This should set an authenticated state (JWT/localStorage/cookie) for the app.
    cy.loginAsTestUser();
  });

  it('Referral page shows a shareable link and the Copy button works', () => {
    cy.visit('/referral');

    // The input should contain a URL and include ?ref=
    cy.findByTestId('referral-link-input')
      .should('exist')
      .invoke('val')
      .then((val) => {
        expect(val).to.be.a('string');
        // Link may include or omit ref if userId unavailable; with login it should exist.
        expect(val as string).to.contain('?ref=');
      });

    // Copy should toggle to "Copied!"
    cy.findByTestId('copy-referral-button').click();
    cy.findByTestId('copy-referral-button').should('contain.text', 'Copied!');
  });

  it('Attribution cookie is set when visiting with ?ref=', () => {
    const code = 'smoke123';
    cy.clearCookies();
    cy.visit('/?ref=' + code);

    // lv_ref is httpOnly; Cypress can still assert it via cy.getCookie
    cy.getCookie('lv_ref').should((c) => {
      expect(c).to.exist;
      expect(c?.value).to.eq(code);
    });
  });
});
// --- REPLACE END ---
