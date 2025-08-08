// --- REPLACE START: standalone backend auth service (no frontend imports) ---
// Using loose typing to avoid TS errors if @types/express is not installed
type Request = any;
type Response = any;

import jwt from 'jsonwebtoken';

/**
 * This service is backend-only and must not import anything from the client.
 * It provides helpers to:
 *  - sign/verify access & refresh tokens (JWT)
 *  - set/clear refresh token cookie
 *  - produce standard login/refresh/logout flows
 *
 * Integrate your own DB lookups inside the marked TODO sections.
 */

/* =========================
 * Environment configuration
 * ========================= */
const {
  JWT_ACCESS_SECRET = 'dev_access_secret_change_me',
  JWT_REFRESH_SECRET = 'dev_refresh_secret_change_me',
  ACCESS_TOKEN_EXPIRES_IN = '15m',
  REFRESH_TOKEN_EXPIRES_IN = '30d',
  NODE_ENV = 'development',
  COOKIE_DOMAIN, // optional
} = process.env;

const isProd = NODE_ENV === 'production';

/* =========================
 * Cookie options
 * ========================= */
export const REFRESH_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions = {
  httpOnly: true as const,
  secure: isProd,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  path: '/' as const,
  // domain: COOKIE_DOMAIN,
};

/* =========================
 * Token helpers (JWT)
 * ========================= */
type JwtPayloadCommon = {
  sub: string; // user id
};

// --- REPLACE START: compatible payload type for all jsonwebtoken versions ---
type JwtPayloadLoose = {
  sub?: string;
  [key: string]: any;
};
// --- REPLACE END ---

export function signAccessToken(userId: string) {
  const payload: JwtPayloadCommon = { sub: userId };
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(userId: string) {
  const payload: JwtPayloadCommon = { sub: userId };
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyRefreshToken(token: string): JwtPayloadCommon {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayloadLoose;
  if (!decoded?.sub) {
    throw new Error('Invalid refresh token payload');
  }
  return { sub: String(decoded.sub) };
}

/* =========================
 * Cookie utilities
 * ========================= */
export function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...refreshCookieOptions,
    maxAge: 0,
  });
}

export function readRefreshCookie(req: Request): string | null {
  return (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? null;
}

/* ==========================================
 * DB/User helpers (replace with your own DB)
 * ========================================== */
async function getUserById(userId: string) {
  // TODO: Replace with real DB lookup
  return { id: userId, email: 'placeholder@example.com', name: 'User' };
}

export async function validateUserCredentials(email: string, password: string) {
  // TODO: Replace with real validation logic
  return { id: 'user123', email, name: 'Test User' };
}

/* =========================
 * High-level auth operations
 * ========================= */
export async function issueTokensForUser(res: Response, userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

export async function handleLogin(res: Response, userId: string) {
  return issueTokensForUser(res, userId);
}

export async function handleRefresh(req: Request, res: Response) {
  const tokenFromCookie = readRefreshCookie(req);
  if (!tokenFromCookie) {
    throw new Error('Missing refresh token');
  }
  const { sub: userId } = verifyRefreshToken(tokenFromCookie);
  const newRefresh = signRefreshToken(userId);
  setRefreshCookie(res, newRefresh);
  const accessToken = signAccessToken(userId);
  return { accessToken };
}

export async function handleLogout(res: Response) {
  clearRefreshCookie(res);
  return { ok: true };
}

export async function getMe(userId: string) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}
// --- REPLACE END ---
