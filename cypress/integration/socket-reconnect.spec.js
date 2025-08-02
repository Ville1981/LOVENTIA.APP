// cypress/integration/socket-reconnect.spec.js

describe('Socket Reconnect & Deduplication', () => {
  const peerId = '2';
  const apiUrl = `/api/messages/${peerId}`;
  const testMessage = { id: 'test1', text: 'Hello test', sender: peerId };

  beforeEach(() => {
    // Stub initial history to empty
    cy.intercept('GET', apiUrl, []).as('getHistory');
    cy.visit(`/chat/${peerId}`);
    cy.wait('@getHistory');
  });

  it('deduplicates duplicate newMessage events', () => {
    cy.window().then((win) => {
      // Ensure socket is connected
      win.connectSocket();
      // Emit the same message twice
      win.socket.emit('newMessage', testMessage);
      win.socket.emit('newMessage', testMessage);
    });

    // Message should appear only once
    cy.contains('Hello test').should('exist');
    cy.get('div.p-2').filter(':contains("Hello test")').should('have.length', 1);
  });

  it('automatically reconnects after disconnect', () => {
    cy.window().then((win) => {
      // Spy on the socket.connect method
      const connectSpy = cy.spy(win.socket, 'connect');

      // Force disconnect
      win.disconnectSocket();

      // Wait to allow auto-reconnect attempts
      cy.wait(3000).then(() => {
        expect(connectSpy).to.have.been.called;
      });
    });
  });
});
