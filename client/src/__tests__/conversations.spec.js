// File: cypress/integration/conversations.spec.js
/// <reference types="cypress" />

describe('Conversations Overview E2E', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/messages/overview', {
      body: [
        {
          userId: '1',
          avatarUrl: '/img/1.jpg',
          displayName: 'Charlie',
          lastMessageSnippet: 'Hey there!',
          lastMessageTimestamp: new Date().toISOString(),
          unreadCount: 1,
        },
      ],
    }).as('getOverview');

    cy.visit('/messages');
  });

  it('displays a list of conversations', () => {
    cy.wait('@getOverview');
    cy.contains('Charlie').should('be.visible');
    cy.contains('Hey there!').should('be.visible');
  });

  it('navigates to chat on click', () => {
    cy.wait('@getOverview');
    cy.get('[data-testid="conversation-card-1"]').click();
    cy.url().should('include', '/chat/1');
  });
});
