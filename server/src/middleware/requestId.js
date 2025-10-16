// server/src/middleware/requestId.js
// --- REPLACE START ---
import { randomUUID } from 'node:crypto';

export default function requestId() {
  return function(req, res, next) {
    const headerId = req.headers['x-request-id'];
    const amzn = req.headers['x-amzn-trace-id']; // "Root=1-...."
    const rid = (typeof headerId === 'string' && headerId.trim()) ? headerId.trim()
              : (typeof amzn === 'string' && amzn.trim()) ? amzn.trim()
              : randomUUID();

    req.requestId = rid;
    res.locals.requestId = rid;
    res.setHeader('x-request-id', rid);
    next();
  };
}
// --- REPLACE END ---
