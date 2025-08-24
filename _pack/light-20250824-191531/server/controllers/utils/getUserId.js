// --- REPLACE START: normalized user id extractor ---
/**
 * Normalized way to read the authenticated user's id from request.
 * Works with the upgraded authenticate middleware ({ userId, role, ... }).
 */
export default function getUserId(req) {
  return req?.user?.userId || req?.userId || null;
}
// --- REPLACE END ---
