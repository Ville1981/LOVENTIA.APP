// cypress/e2e/auth/refresh-failure.cy.js

describe('Auth: refresh failure redirects to /login', () => {
  beforeEach(() => {
    // 1) Log in and set a valid refresh cookie
    cy.loginViaApi(); // custom command that logs in and sets cookies

    // 2) Overwrite the refresh cookie to an expired value
    cy.setCookie('refreshToken', 'invalid-or-expired-token');
  });

  it('should redirect to /login when refresh fails', () => {
    // 3) Visit a protected page that triggers refresh behind the scenes
    cy.visit('/messages');

    // 4) You should land on login page
    cy.url().should('include', '/login');
    cy.contains('Login').should('be.visible');
  });
});
