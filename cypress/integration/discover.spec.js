describe('Discover Filters E2E', () => {
  beforeEach(() => {
    // Stubataan initial GET ja filter-POST
    cy.intercept('GET',  '**/api/discover',        { users: [] }).as('getDiscover');
    cy.intercept('POST', '**/api/discover/filter', { users: [] }).as('filterProfiles');

    cy.visit('/discover');
    cy.wait('@getDiscover');
  });

  it('täyttää suodattimet ja kutsuu filter-APIa', () => {
    // Napin klikkaus laukaisee handleFilter -> POST
    cy.get('[data-cy=DiscoverFilters__submitButton]').click();

    cy.wait('@filterProfiles').its('response.statusCode').should('eq', 200);
  });
});
