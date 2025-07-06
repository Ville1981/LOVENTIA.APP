describe('Profile Form E2E', () => {
  beforeEach(() => {
    // Profiilin lataus (GET) ja päivitys (PUT)
    cy.fixture('user.json').then((user) => {
      cy.intercept('GET',  '**/api/users/me',      { user }).as('getUser');
    });
    cy.intercept('PUT',  '**/api/users/profile', { success: true }).as('updateProfile');

    cy.visit('/profile');
    cy.wait('@getUser');
  });

  it('näyttää validointivirheet virheellisillä arvoilla', () => {
    cy.get('[data-cy=FormBasicInfo__usernameInput]').clear();
    cy.get('[data-cy=ProfileForm__saveButton]').click();

    cy.get('[data-cy=FormBasicInfo__usernameError]')
      .should('be.visible')
      .and('contain', 'Pakollinen kenttä');
  });

  it('lähettää lomakkeen oikein kun validi', () => {
    cy.get('[data-cy=FormBasicInfo__usernameInput]').type('Matti');
    cy.get('[data-cy=FormBasicInfo__emailInput]').type('matti@example.com');
    cy.get('[data-cy=ProfileForm__saveButton]').click();

    cy.wait('@updateProfile').its('response.statusCode').should('eq', 200);
  });
});
