// PATH: server/src/utils/generateTokens.js

// --- REPLACE START: JWT token generator (access + refresh, with forced userId/uid in payload) ---
import jwt from "jsonwebtoken";

/**
 * We keep secrets flexible so different codepaths (old/new) both work.
 * Priority:
 *   1) JWT_SECRET / JWT_REFRESH_SECRET (new)
 *   2) ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET (older setups)
 *   3) hardcoded dev fallback (DO NOT USE IN PROD)
 *
 * NOTE:
 * We export only functions — no top-level side effects — so this file stays
 * safe to import from routes, controllers and even tests.
 */
const ACCESS_SECRET =
  process.env.JWT_SECRET ||
  process.env.ACCESS_TOKEN_SECRET ||
  "dev_access_secret";

const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  process.env.REFRESH_TOKEN_SECRET ||
  "dev_refresh_secret";

/**
 * Default expirations. Keep them readable and project-level.
 * You can adjust later from .env if needed.
 */
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h"; // e.g. "15m", "2h"
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

/**
 * Helper: make sure we always return a string id (or empty string).
 */
function normalizeId(any) {
  if (!any) return "";
  if (typeof any === "string") return any;
  if (typeof any === "number") return String(any);
  if (typeof any.toString === "function") return any.toString();
  return "";
}

/**
 * Build safe payload from user document **or** from an already-built payload.
 *
 * IMPORTANT (matches authController.js):
 * - we ALWAYS pack ALL id fields:
 *     sub, id, userId, uid
 * - reason: some routes were reading only `uid`, others only `userId`,
 *   and PS scripts sometimes only had `sub`.
 * - by forcing all four, we stop that class of bugs.
 *
 * ALSO:
 * - we do NOT put password, reset tokens, or other sensitive data here.
 * - we do NOT put entire billing objects here.
 */
function buildUserPayload(userLike) {
  // If caller passed a plain payload like `{ sub: '...', id: '...', role: 'admin' }`
  // we respect that but we still make sure userId/uid are present.
  if (userLike && typeof userLike === "object" && userLike.sub && userLike.id) {
    const forcedId = normalizeId(
      userLike.sub ||
        userLike.id ||
        userLike.userId ||
        userLike.uid ||
        userLike._id
    );
    const isPremiumForced =
      userLike.isPremium === true ||
      userLike.premium === true ||
      (userLike.entitlements &&
        userLike.entitlements.tier === "premium");

    return {
      ...userLike,
      sub: forcedId,
      id: forcedId,
      userId: forcedId,
      uid: forcedId,
      isPremium: isPremiumForced,
      premium: isPremiumForced,
    };
  }

  if (!userLike) {
    return {
      sub: "anon",
      id: "anon",
      userId: "anon",
      uid: "anon",
      role: "guest",
      isPremium: false,
      premium: false,
    };
  }

  const rawId =
    userLike._id ||
    userLike.id ||
    userLike.userId ||
    userLike.uid ||
    (userLike.user && userLike.user._id) ||
    (userLike.user && userLike.user.id) ||
    "";
  const id = normalizeId(rawId);

  // normalized premium flags
  const isPremium =
    userLike.isPremium === true ||
    userLike.premium === true ||
    (userLike.entitlements &&
      userLike.entitlements.tier === "premium");

  const payload = {
    sub: id,
    id,
    userId: id,
    uid: id,
    email: userLike.email || null,
    role: userLike.role || "user",
    isPremium,
    premium: isPremium,
  };

  // expose entitlements tier very lightly (helps FE to avoid extra /me)
  if (userLike.entitlements && typeof userLike.entitlements === "object") {
    payload.entitlements = {
      tier: userLike.entitlements.tier || (isPremium ? "premium" : "free"),
    };
  }

  return payload;
}

/**
 * Sign a short-lived access token.
 *
 * You can pass:
 *   - a full user doc (with _id, email, role, isPremium)
 *   - OR a ready-made payload (we will still make sure userId/uid exist)
 *   - OR null/undefined → will create a guest token
 */
export function signAccessToken(userLike, extraClaims = {}) {
  const payload = {
    ...buildUserPayload(userLike),
    ...extraClaims,
  };

  const token = jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  return token;
}

/**
 * Sign a long-lived refresh token.
 * NOTE: in this simple version we don't persist refresh tokens to DB.
 * If you need "single session" semantics, add a DB store later.
 *
 * We also mark this token with `type: "refresh"` so controllers can quickly
 * reject non-refresh tokens in /api/auth/refresh.
 */
export function signRefreshToken(userLike, extraClaims = {}) {
  const payload = {
    ...buildUserPayload(userLike),
    type: "refresh",
    ...extraClaims,
  };

  const token = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });

  return token;
}

/**
 * Convenience: issue both tokens at once.
 * Returns:
 *   {
 *     accessToken: "...",
 *     refreshToken: "...",
 *     tokenType: "Bearer",
 *     expiresIn: <seconds>,          // for access
 *     refreshExpiresIn: <seconds?>   // optional, only if we can compute it safely
 *   }
 *
 * NOTE:
 * We keep the logic simple and stable; controller (authController.js) already
 * catches and falls back if this function is missing or throws.
 */
export function issueTokens(userLike, extraClaims = {}) {
  const accessToken = signAccessToken(userLike, extraClaims);
  const refreshToken = signRefreshToken(userLike, extraClaims);

  // convert configured expiry (like "2h") to a numeric seconds is messy,
  // so we give a good default and let FE rely on /refresh.
  const expiresInSeconds =
    Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200); // 2h default

  // We can try to estimate refresh in seconds if given as plain number.
  // If user set e.g. JWT_REFRESH_EXPIRES_IN=2592000 (30d), we pass it along.
  const refreshExpiresInSeconds = Number.isFinite(
    Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS)
  )
    ? Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS)
    : undefined;

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: expiresInSeconds,
    refreshExpiresIn: refreshExpiresInSeconds,
  };
}

/**
 * Small helper to verify refresh if you later need it in /refresh controller.
 * Not strictly required right now, but keeps util complete.
 *
 * We return the same shape that authController.js expects:
 *   { ok: true, decoded }
 *   { ok: false, error }
 *
 * Also: we mirror the controller's priority of secrets:
 *   JWT_REFRESH_SECRET → REFRESH_TOKEN_SECRET → "dev_refresh_secret"
 * so if env changes, both sides stay in sync.
 */
export function verifyRefreshToken(token) {
  // If you ever want to support a "kid" / rotation, do it here.
  const secretsToTry = [
    process.env.JWT_REFRESH_SECRET,
    process.env.REFRESH_TOKEN_SECRET,
    REFRESH_SECRET, // the one from the top
    "dev_refresh_secret",
  ].filter(Boolean);

  for (const sec of secretsToTry) {
    try {
      const decoded = jwt.verify(token, sec);
      // Make sure id fields are present even for older tokens
      const fixed = buildUserPayload(decoded);
      return { ok: true, decoded: fixed };
    } catch (err) {
      // try next
    }
  }

  return {
    ok: false,
    error: new Error("Invalid or expired refresh token"),
  };
}
// --- REPLACE END ---



