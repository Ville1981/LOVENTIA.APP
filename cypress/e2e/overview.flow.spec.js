// cypress/e2e/overview.flow.spec.js
// Cypress E2E tests for Conversations Overview UI

describe('Conversations Overview', () => {
  beforeEach(() => {
    // Clear any existing intercepts
    cy.intercept('/api/messages/overview', (req) => req.continue());
  });

  it('displays loading state while fetching', () => {
    // Simulate network delay
    cy.intercept('GET', '/api/messages/overview', {
      delay: 1000,
      statusCode: 200,
      body: [],
    }).as('getOverview');

    cy.visit('/messages');
    // Loading indicator should appear
    cy.contains('Loading conversations').should('be.visible');
    // Wait for request
    cy.wait('@getOverview');
  });

  it('shows empty state when no conversations', () => {
    cy.intercept('GET', '/api/messages/overview', {
      statusCode: 200,
      body: [],
    }).as('getEmpty');

    cy.visit('/messages');
    cy.wait('@getEmpty');
    // Empty message should be displayed
    cy.contains('No conversations yet').should('be.visible');
  });

  it('shows error state on server error', () => {
    cy.intercept('GET', '/api/messages/overview', {
      statusCode: 500,
      body: { message: 'Server error' },
    }).as('getError');

    cy.visit('/messages');
    cy.wait('@getError');
    // Error message should render
    cy.contains('Unable to load conversations').should('be.visible');
  });

  it('renders a list of conversations when data is available', () => {
    const mockConversations = [
      {
        userId: 'user123',
        peerName: 'Alice',
        peerAvatarUrl: '/avatar1.png',
        lastMessage: 'Hello!',
        lastMessageTimestamp: new Date().toISOString(),
        unreadCount: 2,
      },
      {
        userId: 'user456',
        peerName: 'Bob',
        peerAvatarUrl: null,
        lastMessage: 'See you soon',
        lastMessageTimestamp: new Date().toISOString(),
        unreadCount: 0,
      },
    ];
    cy.intercept('GET', '/api/messages/overview', {
      statusCode: 200,
      body: mockConversations,
    }).as('getList');

    cy.visit('/messages');
    cy.wait('@getList');

    // Check that each conversation card renders correctly
    cy.get('a').should('have.length', mockConversations.length);
    cy.contains('Alice').should('be.visible');
    cy.contains('Hello!').should('be.visible');
    cy.contains('2').should('be.visible');
    cy.contains('Bob').should('be.visible');
    cy.contains('See you soon').should('be.visible');
  });
});
