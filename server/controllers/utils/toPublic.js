// --- REPLACE START: public projection helper (expose politicalIdeology + keep original shape) ---
/**
 * Convert a User mongoose document to a public-safe JSON object.
 * - Keeps virtuals (id, country/region/city, lat/lng) via schema options.
 * - Removes secrets by constructing a new plain object (no mutation).
 * - Ensures `politicalIdeology` is always present for the UI
 *   (reads from canonical `politicalIdeology` or legacy `ideology` virtual).
 * - Preserves existing keys so the client does not break.
 * All comments are in English.
 */
export default function toPublic(userDoc) {
  if (!userDoc) return null;

  // Prefer Mongoose's toObject when available to include virtuals
  const src = typeof userDoc.toObject === 'function'
    ? userDoc.toObject({ virtuals: true })
    : userDoc;

  // Defensive reads
  const location = src.location || {};

  // Build a safe public object (do not leak password, tokens, etc.)
  const pub = {
    // Core identity
    id:            src.id || (src._id ? String(src._id) : undefined),
    username:      src.username,
    email:         src.email,
    role:          src.role,
    isPremium:     Boolean(src.isPremium),

    // Profile details
    name:          src.name,
    age:           src.age,
    gender:        src.gender,
    status:        src.status,
    religion:      src.religion,
    religionImportance: src.religionImportance,
    children:      src.children,
    pets:          src.pets,
    summary:       src.summary,

    // Career / lifestyle / body details
    goal:               src.goal,
    lookingFor:         src.lookingFor,
    profession:         src.profession,
    professionCategory: src.professionCategory,
    bodyType:           src.bodyType,
    height:             src.height,
    heightUnit:         src.heightUnit,
    weight:             src.weight,
    weightUnit:         src.weightUnit,
    education:          src.education,
    healthInfo:         src.healthInfo,
    activityLevel:      src.activityLevel,
    nutritionPreferences: Array.isArray(src.nutritionPreferences) ? src.nutritionPreferences : [],

    // Orientation and politics
    orientation:        src.orientation,
    politicalIdeology:  src.politicalIdeology ?? src.ideology ?? '',

    // Location (nested and convenience top-levels)
    location: {
      country: location.country,
      region:  location.region,
      city:    location.city,
    },
    country:  src.country ?? location.country,
    region:   src.region  ?? location.region,
    city:     src.city    ?? location.city,

    customCity:    src.customCity,
    customRegion:  src.customRegion,
    customCountry: src.customCountry,

    // Coordinates + virtual compatibility
    latitude:   src.latitude,
    longitude:  src.longitude,
    lat:        src.lat ?? src.latitude,
    lng:        src.lng ?? src.longitude,

    // Discover preferences
    preferredGender:    src.preferredGender,
    preferredMinAge:    src.preferredMinAge,
    preferredMaxAge:    src.preferredMaxAge,
    preferredInterests: Array.isArray(src.preferredInterests) ? src.preferredInterests : [],

    // Interests
    interests: Array.isArray(src.interests) ? src.interests : [],

    // Lifestyle
    smoke: src.smoke,
    drink: src.drink,
    drugs: src.drugs,

    // Media
    profilePicture: src.profilePicture,
    extraImages:    Array.isArray(src.extraImages) ? src.extraImages : [],

    // Social graph / actions
    likes:        Array.isArray(src.likes) ? src.likes : [],
    passes:       Array.isArray(src.passes) ? src.passes : [],
    superLikes:   Array.isArray(src.superLikes) ? src.superLikes : [],
    blockedUsers: Array.isArray(src.blockedUsers) ? src.blockedUsers : [],

    // Timestamps
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  };

  // NOTE: We intentionally DO NOT include secrets:
  // - password, refreshTokens, passwordResetToken, passwordResetExpires, __v

  return pub;
}
// --- REPLACE END ---
