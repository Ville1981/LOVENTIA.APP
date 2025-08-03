// cypress/e2e/chat.flow.spec.js

// End-to-end test for real-time chat flow
// Requires seed or mock server state to be reset in beforeEach

describe('Chat Flow', () => {
  beforeEach(() => {
    // Reset and seed the database or mock server state if needed
    cy.loginViaApi();
    cy.visit('/messages');
  });

  it('creates a new conversation and sends/receives messages', () => {
    // Start a new conversation with user having ID 123
    cy.get('[data-test=new-conversation-button]').click();
    cy.get('[data-test=conversation-input]').type('123');
    cy.get('[data-test=start-conversation]').click();

    // Ensure chat page loaded
    cy.url().should('include', '/chat/123');

    // Send a message via input and Enter key
    cy.get('[data-test=message-input]')
      .type('Hello, this is a test message{enter}');

    // Verify message appears in the chat window
    cy.get('[data-test=message-list]')
      .should('contain', 'Hello, this is a test message');

    // Simulate incoming socket message from peer
    cy.window().then((win) => {
      const incoming = {
        sender: '123',
        _id: 'msg-incoming-1',
        text: 'Reply message',
        createdAt: Date.now(),
      };
      // --- REPLACE START ---
      // Our backend/socket emits on 'message', not 'newMessage'
      win.socket.emit('message', incoming);
      // --- REPLACE END ---
    });

    // Verify incoming message is displayed
    cy.get('[data-test=message-list]')
      .should('contain', 'Reply message');
  });
});
