// File: server/tests/requireAdmin.test.js

// --- REPLACE START: unit tests for requireAdmin middleware ---
/* eslint-env jest */
import requireAdmin from '../src/middleware/requireAdmin.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAdmin middleware', () => {
  test('allows admin users (role=admin) to pass', async () => {
    const req = { user: { _id: '1', role: 'admin', isAdmin: true } };
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks non-admin users with 403', async () => {
    const req = { user: { _id: '2', role: 'user', isAdmin: false } };
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body?.error || body?.message).toMatch(/forbidden|admin/i);
  });

  test('blocks when req.user missing (401 or 403)', async () => {
    const req = {}; // no user
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    // Accept either 401 or 403 depending on your implementation
    const calledWith = res.status.mock.calls[0]?.[0];
    expect([401, 403]).toContain(calledWith);
  });
});
// --- REPLACE END ---
