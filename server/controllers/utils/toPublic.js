// --- REPLACE START: public projection helper ---
/**
 * Convert a User mongoose document to a public-safe JSON object.
 * Removes secrets while keeping virtuals (e.g., id).
 *
 * NOTE:
 * - Ensures `politicalIdeology` is always present in the payload.
 *   If legacy field `ideology` exists and `politicalIdeology` is missing,
 *   we map it to `politicalIdeology` for read-compatibility.
 */
export default function toPublic(userDoc) {
  if (!userDoc) return null;

  // Keep virtuals like `id`
  const obj = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };

  // Strip sensitive/internal fields
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.__v;

  // ---- Read-side normalization / compatibility bridges ----
  // 1) Legacy -> current: ideology -> politicalIdeology (do not mutate DB, just the projection)
  if (
    (obj.politicalIdeology === undefined || obj.politicalIdeology === null) &&
    (obj.ideology !== undefined && obj.ideology !== null)
  ) {
    obj.politicalIdeology = obj.ideology;
  }

  // (Optional safety) Ensure empty string instead of undefined for the client if still missing
  if (obj.politicalIdeology === undefined || obj.politicalIdeology === null) {
    obj.politicalIdeology = "";
  }

  return obj;
}
// --- REPLACE END ---
