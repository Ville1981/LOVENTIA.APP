
// cypress/e2e/errorStates.spec.js

describe('Error and Loading States', () => {
  beforeEach(() => {
    cy.loginViaApi();
  });

  it('displays loading spinner and then messages overview', () => {
    // Delay the overview API to simulate loading
    cy.intercept('GET', '/api/messages/overview', (req) => {
      req.on('response', (res) => {
        res.setDelay(2000);
      });
    }).as('getOverview');

    cy.visit('/messages');
    cy.get('[data-test=loading-spinner]').should('be.visible');
    cy.wait('@getOverview');
    cy.get('[data-test=conversation-list]').should('exist');
  });

  it('shows error component on overview fetch failure', () => {
    // Force an error response
    cy.intercept('GET', '/api/messages/overview', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('getOverviewError');

    cy.visit('/messages');
    cy.wait('@getOverviewError');
    cy.get('[data-test=error-component]')
      .should('be.visible')
      .and('contain', 'Unable to load conversations');
  });

  it('shows socket connection error feedback', () => {
    cy.visit('/chat/123');

    // Simulate socket connection error
    cy.window().then((win) => {
      win.socket.emit('connect_error', new Error('Socket failure'));
    });

    cy.get('[data-test=socket-error-notification]')
      .should('be.visible')
      .and('contain', 'Connection lost. Reconnecting...');
  });
});
