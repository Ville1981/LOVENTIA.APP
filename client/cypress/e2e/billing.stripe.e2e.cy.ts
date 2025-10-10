describe('Billing (mocked)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.loginAsTestUser?.(); // jos teillä on custom komento, muuten tee ohjelmallinen login
  });

  it('starts checkout and reflects premium after success (mocked)', () => {
    // 1) Mockaa checkout-session pyyntö
    cy.intercept('POST', '/api/billing/create-checkout-session', {
      statusCode: 200,
      body: { id: 'cs_test_123', url: '/subscriptions?mockCheckout=1' }
    }).as('createCheckout');

    // 2) Siirry tilauksiin ja käynnistä checkout
    cy.visit('/subscriptions');
    cy.findByTestId('upgrade-button').click();

    cy.wait('@createCheckout').its('response.statusCode').should('eq', 200);

    // 3) Mockkaa "paluu" (onnistunut maksu) – ohitetaan oikea Stripe-redirect
    cy.intercept('GET', '/api/users/me', (req) => {
      req.reply({
        statusCode: 200,
        body: { _id: 'u1', email: 'test@example.com', premium: true, photos: [] }
      });
    }).as('meAfter');

    // 4) Force refresh user state (riippuu toteutuksestanne)
    cy.reload();
    cy.wait('@meAfter');

    // 5) UI näyttää premium-tilan
    cy.findByTestId('premium-badge').should('exist');
  });

  it('portal cancel removes premium (mocked)', () => {
    cy.visit('/subscriptions');

    cy.intercept('POST', '/api/billing/create-portal-session', {
      statusCode: 200,
      body: { url: '/subscriptions?mockPortal=1' }
    }).as('portal');

    cy.findByTestId('open-portal-button').click();
    cy.wait('@portal');

    // Mock after cancellation: premium=false
    cy.intercept('GET', '/api/users/me', (req) => {
      req.reply({
        statusCode: 200,
        body: { _id: 'u1', email: 'test@example.com', premium: false, photos: [] }
      });
    }).as('meAfterCancel');

    cy.reload();
    cy.wait('@meAfterCancel');

    cy.findByTestId('premium-badge').should('not.exist');
  });
});
