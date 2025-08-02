// cypress/support/commands.js

// ***********************************************
// This file defines custom Cypress commands.
// ***********************************************

// Import any other command files here if needed
// import './other-commands';

// -----------------------------------------------
// Custom Command: loginViaApi
// Logs in via the backend API, sets accessToken in localStorage,
// and preserves the HttpOnly refreshToken cookie.
// -----------------------------------------------
Cypress.Commands.add('loginViaApi', () => {
  // --- REPLACE START: adjust URL and credentials as needed ---
  cy.request({
    method: 'POST',
    url: '/api/auth/login', // Backend login endpoint
    body: {
      email: Cypress.env('TEST_USER_EMAIL'),
      password: Cypress.env('TEST_USER_PASSWORD'),
    },
    withCredentials: true, // Ensure refreshToken cookie is set
  }).then((resp) => {
    expect(resp.status).to.eq(200);

    // Persist accessToken for frontend code
    if (resp.body.accessToken) {
      window.localStorage.setItem('accessToken', resp.body.accessToken);
    }
    // The HttpOnly refreshToken cookie is automatically set by the server
  });
  // --- REPLACE END ---
});

// -----------------------------------------------
// Custom Command: loginViaApiAsAdmin
// Logs in via the backend API as an admin user.
// -----------------------------------------------
Cypress.Commands.add('loginViaApiAsAdmin', () => {
  // --- REPLACE START: adjust URL and admin credentials as needed ---
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: Cypress.env('ADMIN_EMAIL'),
      password: Cypress.env('ADMIN_PASSWORD'),
    },
    withCredentials: true,
  }).then((resp) => {
    expect(resp.status).to.eq(200);
    if (resp.body.accessToken) {
      window.localStorage.setItem('accessToken', resp.body.accessToken);
    }
  });
  // --- REPLACE END ---
});

// -----------------------------------------------
// Custom Command: logoutViaApi
// Clears session by calling logout endpoint and removing tokens.
// -----------------------------------------------
Cypress.Commands.add('logoutViaApi', () => {
  // --- REPLACE START: adjust URL if your API prefix differs ---
  cy.request({
    method: 'POST',
    url: '/api/auth/logout',
    withCredentials: true,
  }).then((resp) => {
    expect(resp.status).to.be.oneOf([200, 204]);
    window.localStorage.removeItem('accessToken');
  });
  // --- REPLACE END ---
});

// -----------------------------------------------
// Preserve the refreshToken cookie between tests
// -----------------------------------------------
Cypress.Cookies.defaults({
  preserve: ['refreshToken'],
});

// ***********************************************
// You can add more custom commands here as needed.
// ***********************************************
