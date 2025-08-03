// cypress/integration/profile.spec.js
// E2E-testi profiilin muokkauslomakkeelle
// Sisältää stubit token-refresh-, auth-, käyttäjätiedon hauille sekä päivitykselle

describe('Profile Form E2E', () => {
  beforeEach(() => {
    // Poistetaan vanhat tokenit ja cookiet, jotta stubit osuvat oikein
    cy.clearLocalStorage();
    cy.clearCookies();

    // Stubataan refresh-token-kutsu välittömästi
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: 'dummy-token' },
    }).as('refreshToken');

    // Ladataan fixture ja vasta sitten asennetaan kaikki muut interceptit + sivun lataus
    cy.fixture('user.json').then((user) => {
      // Stubataan kirjautuneen käyttäjän tiedot
      cy.intercept('GET', '**/api/auth/me', {
        statusCode: 200,
        body: user,
      }).as('getAuth');

      // Stubataan oman profiilin tiedot
      cy.intercept('GET', '**/api/users/me', {
        statusCode: 200,
        body: user,
      }).as('getUser');

      // Stubataan profiilin päivitys
      cy.intercept('PUT', '**/api/users/profile', {
        statusCode: 200,
        body: { success: true },
      }).as('updateProfile');

      // Nyt kun kaikki stubit on paikallaan, ladataan profiilisivu
      cy.visit('/profile');

      // Odotetaan, että token-refresh, auth– ja user–kutsut saadaan
      cy.wait('@refreshToken');
      cy.wait('@getAuth');
      cy.wait('@getUser');
    });
  });

  it('näyttää validointivirheet virheellisillä arvoilla', () => {
    // Tyhjennetään pakollinen käyttäjätunnus-kenttä
    cy.get('[data-cy=FormBasicInfo__usernameInput]').clear();
    // Yritetään tallentaa
    cy.get('[data-cy=ProfileForm__saveButton]').click();

    // Virheilmoituksen tulee näkyä
    cy.get('[data-cy=FormBasicInfo__usernameError]')
      .should('be.visible')
      .and('contain', 'Pakollinen kenttä');
  });

  it('lähettää lomakkeen oikein kun validi', () => {
    // Syötetään kaikki pakolliset kentät
    cy.get('[data-cy=FormBasicInfo__usernameInput]')
      .clear()
      .type('Matti');
    cy.get('[data-cy=FormBasicInfo__emailInput]')
      .clear()
      .type('matti@example.com');
    cy.get('[data-cy=FormBasicInfo__ageSelect]').select('30');
    cy.get('[data-cy=FormBasicInfo__genderSelect]').select('Mies');
    cy.get('[data-cy=FormBasicInfo__orientationSelect]').select('Hetero');

    // Lähetetään lomake
    cy.get('[data-cy=ProfileForm__saveButton]').click();

    // Odotetaan stubattu päivitys ja varmistetaan 200
    cy.wait('@updateProfile')
      .its('response.statusCode')
      .should('eq', 200);
  });
});
