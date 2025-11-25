// PATH: server/services/auth.service.js

// --- REPLACE START: auth service (register/login + refresh/me, converted to ESM) ---

import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Resolve __dirname for this ESM module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robust User model resolver for service layer.
 * Tries several common locations and supports both ESM (.js) and CJS (.cjs).
 */
async function getUserModel() {
  const candidates = [
    "../models/User.cjs", // current repo layout (server/models/User.cjs)
    "../models/User.js",
    "./models/User.cjs",
    "./models/User.js",
    "../src/models/User.js",
  ];

  for (const rel of candidates) {
    try {
      const abs = path.resolve(__dirname, rel);
      const ns = await import(pathToFileURL(abs).href);
      const mod = ns?.default ?? ns;
      if (mod) return mod;
    } catch {
      // continue trying next candidate
    }
  }

  console.error("[auth.service] Unable to resolve User model from service layer");
  return null;
}

/**
 * Helper: build a standard JWT payload with all id fields.
 */
function buildJwtPayloadFromUser(user) {
  const idRaw = user?._id || user?.id;
  const id = idRaw ? String(idRaw) : "";
  return {
    sub: id,
    id,
    userId: id,
    uid: id,
    email: user?.email,
    role: user?.role,
    isPremium: Boolean(user?.isPremium),
  };
}

/**
 * Helper: access/refresh secrets with sane fallbacks.
 */
function getAccessSecret() {
  return (
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "dev_access_secret"
  );
}

function getRefreshSecret() {
  return (
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    "dev_refresh_secret"
  );
}

/**
 * Service: register a new user (validation + password hashing)
 */
export async function registerUserService(req, res) {
  const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email and password are required" });
  }

  const User = await getUserModel();
  if (!User) {
    return res
      .status(500)
      .json({ error: "Server configuration error (user model missing)" });
  }

  try {
    if (await User.exists({ email })) {
      return res.status(409).json({ error: "Email already in use" });
    }
    if (await User.exists({ username })) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res
      .status(500)
      .json({ error: "Server error during registration" });
  }
}

/**
 * Service: login user (verify credentials, issue tokens, set refresh cookie)
 */
export async function loginUserService(req, res, { refreshCookieOptions }) {
  const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
  const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const User = await getUserModel();
  if (!User) {
    return res
      .status(500)
      .json({ error: "Server configuration error (user model missing)" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const basePayload = buildJwtPayloadFromUser(user);

    const accessToken = jwt.sign(basePayload, getAccessSecret(), {
      expiresIn: ACCESS_EXPIRES,
    });

    const refreshToken = jwt.sign(
      { ...basePayload, type: "refresh" },
      getRefreshSecret(),
      {
        expiresIn: REFRESH_EXPIRES,
      }
    );

    if (refreshCookieOptions) {
      res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    }

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isPremium: Boolean(user.isPremium),
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error during login" });
  }
}

/**
 * Service: refresh access token
 *
 * IMPORTANT:
 * - Looks for token in body.refreshToken, Authorization: Bearer <token>,
 *   and several cookie names (refreshToken, refresh_token, jwt, jid, token).
 * - Uses the same secret priority as controller:
 *     JWT_REFRESH_SECRET → REFRESH_TOKEN_SECRET → "dev_refresh_secret"
 */
export async function refreshService(req, res, { refreshCookieOptions }) {
  const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
  const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

  const bodyToken =
    req?.body && typeof req.body.refreshToken === "string"
      ? req.body.refreshToken
      : "";

  const bearerToken =
    req?.headers && typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/Bearer\s+/i, "").trim()
      : "";

  const cookieTokenRaw =
    req?.cookies &&
    (req.cookies.refreshToken ||
      req.cookies.refresh_token ||
      req.cookies.jwt ||
      req.cookies.jid ||
      req.cookies.token);

  const cookieToken =
    typeof cookieTokenRaw === "string"
      ? cookieTokenRaw
      : cookieTokenRaw
      ? String(cookieTokenRaw)
      : "";

  let refreshToken = (bodyToken || bearerToken || cookieToken || "").trim();

  if (!refreshToken) {
    // No token in body/header/cookies → unauthenticated
    return res.status(401).json({ error: "Refresh token required" });
  }

  const User = await getUserModel();
  if (!User) {
    return res
      .status(500)
      .json({ error: "Server configuration error (user model missing)" });
  }

  try {
    // Verify with refresh secret (same as controller)
    const decoded = jwt.verify(refreshToken, getRefreshSecret());

    const decodedId =
      decoded?.sub ||
      decoded?.userId ||
      decoded?.uid ||
      decoded?._id ||
      decoded?.id ||
      "";

    if (!decodedId) {
      console.warn("[auth.service/refresh] token did not contain any id");
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decodedId);
    if (!user) {
      console.warn("[auth.service/refresh] user not found for id:", decodedId);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const basePayload = buildJwtPayloadFromUser(user);

    const newAccessToken = jwt.sign(basePayload, getAccessSecret(), {
      expiresIn: ACCESS_EXPIRES,
    });

    const newRefreshToken = jwt.sign(
      { ...basePayload, type: "refresh" },
      getRefreshSecret(),
      {
        expiresIn: REFRESH_EXPIRES,
      }
    );

    if (refreshCookieOptions) {
      res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    }

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res
      .status(401)
      .json({ error: "Invalid or expired refresh token" });
  }
}

/**
 * Service: return current logged-in user ("me")
 */
export async function meService(req, res) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const User = await getUserModel();
  if (!User) {
    return res
      .status(500)
      .json({ error: "Server configuration error (user model missing)" });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, getAccessSecret());
    } catch {
      // fallback: accept refresh token for /me as well (similar to controller.me)
      decoded = jwt.verify(token, getRefreshSecret());
    }

    const userId =
      decoded?.sub ||
      decoded?.userId ||
      decoded?.uid ||
      decoded?._id ||
      decoded?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// --- REPLACE END ---

