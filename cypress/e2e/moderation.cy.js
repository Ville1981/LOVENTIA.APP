// cypress/e2e/moderation.cy.js

describe('Moderation Flow', () => {
  before(() => {
    // Clean state if needed, or seed database via API
    // e.g. cy.task('resetDatabase');
  });

  beforeEach(() => {
    // 1) Log in as regular user and send a test message
    cy.loginViaApi(); // sets user cookies & localStorage
    cy.request({
      method: 'POST',
      url: '/api/messages/12345', // pick a peer userId; adjust as needed
      body: { text: 'This is a test message to be reported' },
      withCredentials: true,
    }).then((resp) => {
      expect(resp.status).to.eq(201);
      // Save the newly created message ID
      Cypress.env('TEST_MESSAGE_ID', resp.body._id);
    });

    // 2) Log out and log in as moderator/admin
    cy.logoutViaApi(); // assume you have a command to clear cookies & set admin creds
    cy.loginViaApiAsAdmin(); // set up admin session
  });

  it('allows user to report a message and moderator to resolve it', () => {
    // 3) As a regular user, report the message
    cy.logoutViaApi();
    cy.loginViaApi(); // back to regular user
    cy.request({
      method: 'POST',
      url: '/api/moderation/report',
      body: {
        messageId: Cypress.env('TEST_MESSAGE_ID'),
        reason: 'Inappropriate content',
      },
      withCredentials: true,
    }).then((resp) => {
      expect(resp.status).to.eq(201);
      expect(resp.body).to.have.property('reportId');
      Cypress.env('REPORT_ID', resp.body.reportId);
    });

    // 4) As moderator, visit ModerationPanel page
    cy.logoutViaApi();
    cy.loginViaApiAsAdmin();
    cy.visit('/moderation');

    // 5) The reported message should appear
    cy.contains('Pending Reports').should('be.visible');
    cy.contains('This is a test message to be reported').should('be.visible');

    // 6) Approve the report
    cy.contains('Approve').click();

    // 7) The report should be removed from the list
    cy.contains('This is a test message to be reported').should('not.exist');
  });
});
