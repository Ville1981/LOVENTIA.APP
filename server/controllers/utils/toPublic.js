// --- REPLACE START: public projection helper ---
/**
 * Convert a User mongoose document to a public-safe JSON object.
 * Removes secrets while keeping virtuals (e.g., id).
 */
export default function toPublic(userDoc) {
  if (!userDoc) return null;
  const obj = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
}
// --- REPLACE END ---
