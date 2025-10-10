// File: client/cypress/e2e/admin_dashboard.cy.ts

// --- REPLACE START: admin KPI dashboard smoke (mock API) ---
describe('Admin KPI Dashboard (smoke)', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    // If you have a login helper, prefer it:
    // cy.loginAsAdmin?.();
  });

  it('renders KPI cards with mocked data', () => {
    cy.intercept('GET', '/api/admin/metrics/summary', {
      statusCode: 200,
      fixture: 'admin_metrics_summary.json',
    }).as('metrics');

    // Adjust path to your router (/#/ vs /); this works for BrowserRouter on /admin/kpi
    cy.visit('/admin/kpi');
    cy.wait('@metrics');

    cy.findByTestId('kpi-users-total').should('contain.text', '1234');
    cy.findByTestId('kpi-premium-total').should('contain.text', '111');
    cy.findByTestId('kpi-revenue-mtd').should('contain.text', '$4567.89');
    cy.findByTestId('kpi-dau').should('have.text', '321');
    cy.findByTestId('kpi-wau').should('have.text', '789');
    cy.findByTestId('kpi-mau').should('have.text', '1599');

    // A couple of bar labels exist
    cy.contains('Signups (last 7 days)').should('exist');
    cy.contains('Messages sent (last 7 days)').should('exist');
    cy.contains('Jan 1').should('exist'); // depends on fixture labels
  });

  it('shows error banner on 403 (non-admin)', () => {
    cy.intercept('GET', '/api/admin/metrics/summary', {
      statusCode: 403,
      body: { error: 'Admin privileges required.' },
    }).as('metrics403');

    cy.visit('/admin/kpi');
    cy.wait('@metrics403');
    cy.contains(/Admin privileges required|Failed to load KPIs/i).should('exist');
  });
});
// --- REPLACE END ---
