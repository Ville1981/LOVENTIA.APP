// File: cypress/integration/conversations-overview.spec.js
describe('Conversations Overview E2E', () => {
  const apiUrl = '/api/messages/overview';
  const mockList = [
    {
      userId: '1',
      avatarUrl: '/img/1.jpg',
      displayName: 'Alice',
      snippet: 'Hello Alice',
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 1,
    },
    {
      userId: '2',
      avatarUrl: '/img/2.jpg',
      displayName: 'Bob',
      snippet: 'Hey Bob',
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 0,
    },
  ];

  beforeEach(() => {
    cy.visit('/messages');
  });

  it('shows loading spinner then list', () => {
    cy.intercept('GET', apiUrl, {
      delay: 500,
      body: mockList,
    }).as('getOverview');

    cy.get('span[aria-label="Loading..."]').should('exist');
    cy.wait('@getOverview');

    cy.get('h3').contains('Alice').should('be.visible');
    cy.get('h3').contains('Bob').should('be.visible');
  });

  it('displays empty placeholder', () => {
    cy.intercept('GET', apiUrl, []).as('getEmpty');
    cy.reload();
    cy.wait('@getEmpty');

    cy.contains(/start chatting/i).should('be.visible');
  });

  it('handles server error with retry', () => {
    cy.intercept('GET', apiUrl, { statusCode: 500 }).as('getError');
    cy.reload();
    cy.wait('@getError');

    cy.contains(/failed to load conversations/i).should('be.visible');
    cy.contains(/retry/i).click();
    cy.wait('@getError'); // retry triggers new call
  });
});
