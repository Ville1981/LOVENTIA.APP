// File: server/src/middleware/stripeMock.js

// --- REPLACE START: stripeMock middleware ---
export default function stripeMock(req, _res, next) {
  // Enable mock if STRIPE_MOCK_MODE=1 or header x-stripe-mock: on
  const envMock = process.env.STRIPE_MOCK_MODE === '1';
  const hdrVal = req.headers['x-stripe-mock'];
  const hdrMock =
    typeof hdrVal === 'string' && hdrVal.trim().toLowerCase() === 'on';

  // Expose a single boolean flag for downstream handlers/controllers.
  req.__stripeMock = Boolean(envMock || hdrMock);

  next();
}
// --- REPLACE END ---
