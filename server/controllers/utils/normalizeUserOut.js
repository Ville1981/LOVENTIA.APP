// server/utils/normalizeUserOut.js
// Small, focused normalizer to control what the API returns for a user.

function toPosix(p) {
  return typeof p === "string" ? p.replace(/\\/g, "/") : p;
}

function cleanPhotos(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map(toPosix);
}

export function normalizeUserOut(u) {
  if (!u) return null;

  // Support both Mongoose doc and plain object
  const src = typeof u.toObject === "function" ? u.toObject() : u;

  return {
    // --- Identity & essentials ---
    id: String(src._id || src.id),
    email: src.email,
    username: src.username,

    // --- Premium/visibility as-is (if UI uses these) ---
    isPremium: !!src.isPremium,
    premium: src.premium ?? src.isPremium ?? false,
    entitlements: src.entitlements ?? {},
    visibility: src.visibility ?? { isHidden: false },

    // --- Profile fields used by the form/UI ---
    name: src.name,
    age: src.age,
    gender: src.gender,
    country: src.country,
    region: src.region,
    city: src.city,

    // ✅ The important ones that were missing earlier:
    summary: src.summary ?? "",
    politicalIdeology: src.politicalIdeology ?? "",
    nutritionPreferences: Array.isArray(src.nutritionPreferences)
      ? src.nutritionPreferences
      : [],

    // --- Images (normalized to forward slashes; nulls removed) ---
    profilePicture: toPosix(src.profilePicture || src.avatar || src.profilePhoto || null),
    photos: cleanPhotos(src.photos || src.extraImages),

    // --- Timestamps ---
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  };
}

export default normalizeUserOut;
