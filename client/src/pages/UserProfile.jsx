// PATH: client/src/pages/UserProfile.jsx

// --- REPLACE START: wire avatar + extra photos view to MultiStepPhotoUploader + normalizeUserImages; keep profilePicture/photos/extraImages in sync ---
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/profileFields/ProfileForm";
import PhotoCarousel from "../components/discover/PhotoCarousel";
import api from "../services/api/axiosInstance"; // use shared Axios instance (auth + baseURL)
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../config";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";
import { useAuth } from "../contexts/AuthContext";
import { normalizeUserImages } from "../utils/absolutizeImage";

/** Normalize FS path → web path (handles Windows backslashes) */
const toWebPath = (p = "") =>
  "/" + String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");

/** Build absolute/placeholder-safe image src */
const buildImgSrc = (p) => {
  if (!p) return PLACEHOLDER_IMAGE;
  if (String(p).startsWith("http")) return p;
  return `${BACKEND_BASE_URL}${toWebPath(p)}`;
};

/**
 * Extract a usable photo string from:
 *  - plain string
 *  - { url: "..." }
 * Returns null if not usable.
 */
const extractPhotoSrc = (item) => {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.url) return String(item.url);
  return null;
};

/* ────────────────────────────────────────────────────────────────────────────
   FI → EN fallback dictionaries (defensive layer)
   These are used both in form component (pre-submit) and here as a safety net.
   Only include fields known to be localized previously.
──────────────────────────────────────────────────────────────────────────── */
const FI_EN_CHILDREN = {
  Kyllä: "yes",
  Ei: "no",
  "Aikuisia lapsia": "adultChildren",
  Muu: "other",
};
const FI_EN_PETS = {
  Kissa: "cat",
  Koira: "dog",
  Molemmat: "both",
  "Ei lemmikkiä": "none",
  Muu: "other",
};
const FI_EN_EDUCATION = {
  Peruskoulu: "Basic",
  "Toinen aste": "Secondary",
  Ammatillinen: "Vocational",
  "Korkeakoulu / yliopisto": "Higher",
  "Tohtori / tutkimus": "PhD",
  Muu: "Other",
};

/* ────────────────────────────────────────────────────────────────────────────
   Whitelist: fields allowed to be sent to backend in PUT /users/profile
   (Do NOT include server-managed or sensitive fields)
──────────────────────────────────────────────────────────────────────────── */
const ALLOWED_PROFILE_FIELDS = new Set([
  // account & identity (client-managed inputs)
  "username",
  "email",
  // demographics
  "age",
  "gender",
  "orientation",
  // location (both flat + nested will be composed)
  "country",
  "region",
  "city",
  "location",
  "latitude",
  "longitude",
  // body/metrics
  "height",
  "heightUnit",
  "weight",
  "weightUnit",
  "bodyType",
  // lifestyle
  "smoke",
  "drink",
  "drugs",
  "nutritionPreferences",
  "activityLevel",
  "healthInfo",
  // family
  "children",
  "pets",
  // education & work
  "education",
  "professionCategory",
  "profession",
  // beliefs
  "religion",
  "religionImportance",
  "politicalIdeology",
  "ideology", // included temporarily; removed by mapOutgoingPayload
  // dating
  "goal",
  "summary",
  "lookingFor",
  // media (only the primary avatar path; lists are server-managed elsewhere)
  "profilePhoto",
  "profilePicture",
]);

/* ────────────────────────────────────────────────────────────────────────────
   Normalization helpers
   - Centralized around normalizeUserImages so avatar + photos/extraImages
     stay in sync with ExtraPhotosPage / MultiStepPhotoUploader.
──────────────────────────────────────────────────────────────────────────── */
const isEmptyish = (v) => v === "" || v === null || v === undefined;

function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;

  const id = String(u.id || u._id || "");

  // Use shared normalizeUserImages pipeline as the canonical source.
  let baseUser = u;
  let photos = [];
  let profilePictureRaw = u.profilePicture || u.profilePhoto || null;

  try {
    const imgNorm = normalizeUserImages(u);
    if (imgNorm && typeof imgNorm === "object") {
      if (imgNorm.user && typeof imgNorm.user === "object") {
        baseUser = imgNorm.user;
      }
      if (Array.isArray(imgNorm.photos)) {
        photos = imgNorm.photos.map((item) => extractPhotoSrc(item)).filter(Boolean);
      } else if (Array.isArray(imgNorm.extraImages)) {
        photos = imgNorm.extraImages
          .map((item) => extractPhotoSrc(item))
          .filter(Boolean);
      }
      if (imgNorm.profilePicture) {
        profilePictureRaw = imgNorm.profilePicture;
      }
    }
  } catch (err) {
    // Do not break profile page if helper fails; fall back to local logic.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[UserProfile] normalizeUserImages failed:", err);
    }
  }

  // Fallback: derive photos from legacy shapes if helper did not produce anything.
  if (!photos.length) {
    const rawPhotos = Array.isArray(u.photos)
      ? u.photos
      : Array.isArray(u.extraImages)
      ? u.extraImages
      : [];
    photos = rawPhotos.map((item) => extractPhotoSrc(item)).filter(Boolean);
  }

  const profilePicture = profilePictureRaw ? extractPhotoSrc(profilePictureRaw) : null;

  // Location flattening based on the effective user (baseUser)
  const loc =
    baseUser.location && typeof baseUser.location === "object" ? baseUser.location : {};
  const country = baseUser.country || loc.country || null;
  const region = baseUser.region || loc.region || null;
  const city = baseUser.city || loc.city || null;

  const isPremium =
    !!baseUser.isPremium ||
    !!baseUser.premium ||
    (baseUser.entitlements && baseUser.entitlements.tier === "premium");

  const politicalIdeology = baseUser.politicalIdeology ?? baseUser.ideology ?? "";

  return {
    ...baseUser,
    id,
    _id: id || baseUser._id,
    photos,
    extraImages: photos, // keep alias so ExtraPhotosPage / MultiStepPhotoUploader stay in sync
    profilePicture,
    country,
    region,
    city,
    location: {
      ...(loc || {}),
      country,
      region,
      city,
    },
    isPremium,
    politicalIdeology,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   mapOutgoingPayload: legacy compatibility
   - prefer politicalIdeology; drop legacy ideology
   - ensure `location` object when only flat fields are present
──────────────────────────────────────────────────────────────────────────── */
function mapOutgoingPayload(values) {
  const out = { ...(values || {}) };
  if (
    (out.politicalIdeology === undefined || out.politicalIdeology === "") &&
    typeof out.ideology !== "undefined"
  ) {
    out.politicalIdeology = out.ideology;
  }
  if (Object.prototype.hasOwnProperty.call(out, "ideology")) {
    delete out.ideology;
  }
  if (!out.location) {
    const loc = {};
    if ("country" in out) loc.country = out.country;
    if ("region" in out) loc.region = out.region;
    if ("city" in out) loc.city = out.city;
    if (Object.keys(loc).length) out.location = loc;
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   sanitizeAndWhitelistPayload:
   - Convert FI→EN for children/pets/education defensively
   - Coerce numeric strings → numbers; drop invalid numerics
   - Drop empty strings / null / undefined
   - nutritionPreferences: keep array only if length > 0 (UI gives single-select)
   - Whitelist keys (drop anything not explicitly allowed)
   - Remove server-managed fields if present accidentally
   - Finally pass through mapOutgoingPayload for legacy compatibility
──────────────────────────────────────────────────────────────────────────── */
function sanitizeAndWhitelistPayload(data) {
  const src = { ...(data || {}) };

  // Defensive FI→EN fallbacks (if a localized label slipped through)
  if (src.children && FI_EN_CHILDREN[src.children]) {
    src.children = FI_EN_CHILDREN[src.children];
  }
  if (src.pets && FI_EN_PETS[src.pets]) {
    src.pets = FI_EN_PETS[src.pets];
  }
  if (src.education && FI_EN_EDUCATION[src.education]) {
    src.education = FI_EN_EDUCATION[src.education];
  }

  // Units normalization mirrors ProfileForm
  const normalizeHeightUnit = (u) =>
    u === "cm" ? "Cm" : u === "ftin" ? "FtIn" : u || "";
  const normalizeWeightUnit = (u) =>
    u === "KG" ? "kg" : u === "LB" ? "lb" : u || "";
  src.heightUnit = normalizeHeightUnit(src.heightUnit);
  src.weightUnit = normalizeWeightUnit(src.weightUnit);

  // Numeric coercion (drop if invalid)
  ["age", "height", "weight", "latitude", "longitude"].forEach((k) => {
    if (isEmptyish(src[k])) {
      delete src[k];
      return;
    }
    const n = Number(src[k]);
    if (Number.isFinite(n)) src[k] = n;
    else delete src[k];
  });

  // Drop emptyish
  Object.keys(src).forEach((k) => {
    if (isEmptyish(src[k])) delete src[k];
  });

  // nutritionPreferences: string → array; omit if empty
  if (typeof src.nutritionPreferences !== "undefined") {
    const val = Array.isArray(src.nutritionPreferences)
      ? src.nutritionPreferences
      : [String(src.nutritionPreferences || "").trim()].filter(Boolean);
    if (val.length > 0) src.nutritionPreferences = val;
    else delete src.nutritionPreferences;
  }

  // Compose nested location (keeping flat fields as separate top-level too)
  const loc = {};
  if (typeof src.country !== "undefined") loc.country = src.country;
  if (typeof src.region !== "undefined") loc.region = src.region;
  if (typeof src.city !== "undefined") loc.city = src.city;
  if (Object.keys(loc).length) {
    src.location = { ...(src.location || {}), ...loc };
  }

  // Remove server-managed / disallowed fields if any leaked in
  const forbidden = new Set([
    "photos",
    "extraImages",
    "entitlements",
    "visibility",
    "subscriptionId",
    "stripeCustomerId",
    "createdAt",
    "updatedAt",
    "__v",
    "_id",
    "id",
    "quotas",
    "features",
    "tier",
    "until",
    "since",
  ]);
  forbidden.forEach((k) => delete src[k]);

  // Apply whitelist last
  const whitelisted = {};
  Object.keys(src).forEach((k) => {
    if (ALLOWED_PROFILE_FIELDS.has(k)) {
      whitelisted[k] = src[k];
    }
  });

  // Final legacy mapping
  const finalPayload = mapOutgoingPayload(whitelisted);

  // Dev visibility to compare against Network → Payload
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[UserProfile] Final whitelisted payload →", finalPayload);
    window.__lastUserProfilePayload = finalPayload;
  }

  return finalPayload;
}

const UserProfile = () => {
  const { t } = useTranslation(["common", "profile", "lifestyle"]);
  const { userId: userIdParam } = useParams();
  const { user: authUser } = useAuth();

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isOwnProfile = useMemo(() => !userIdParam, [userIdParam]);

  // This changes when logged-in user really changes (multi-session safe)
  const authUserId =
    authUser?.id || authUser?._id || authUser?.uid || authUser?.email || null;

  // Keep local profile user in sync with AuthContext for own profile (multi-session safe)
  useEffect(() => {
    if (!isOwnProfile) return;

    // When logged out while on /profile, clear local user so we do not show stale data
    if (!authUser) {
      setUser(null);
      return;
    }

    const normalized = normalizeUser(authUser);

    setUser((prev) => {
      if (!prev) return normalized;

      const prevId = prev.id || prev._id || prev.uid || prev.email;
      const nextId =
        normalized.id ||
        normalized._id ||
        normalized.uid ||
        normalized.email;

      // If the identity really changed (Ville ↔ MultiSession), replace immediately
      if (prevId && nextId && prevId !== nextId) {
        return normalized;
      }

      // Same identity: keep existing state (may contain unsaved edits)
      return prev;
    });
  }, [isOwnProfile, authUserId, authUser]);

  const refreshUser = useCallback(
    async () => {
      setReloading(true);
      setMessage("");

      try {
        let resolvedUser = null;

        // If we are viewing our own profile and have authUser, use it as baseline
        if (!userIdParam && authUser) {
          resolvedUser = normalizeUser(authUser);
        }

        const apiPath = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(apiPath);
        const fromApi = normalizeUser(res?.data?.user || res?.data);

        resolvedUser = fromApi || resolvedUser;

        if (!mountedRef.current) return;
        setUser(resolvedUser);
      } catch (err) {
        if (!mountedRef.current) return;
        const status = err?.response?.status;
        setMessage(
          (status === 401 &&
            (t("profile:authRequired") || "Authentication required.")) ||
            t("profile:loadError") ||
            "Failed to load profile."
        );
      } finally {
        if (mountedRef.current) setReloading(false);
      }
    },
    [t, userIdParam, authUser, authUserId]
  );

  // Handle submit with sanitize + whitelist
  const handleSubmit = async (data) => {
    setMessage("");
    setSuccess(false);

    // Safety net normalization on page-level too
    const payload = sanitizeAndWhitelistPayload(data);

    try {
      const res = await api.put("/users/profile", payload);
      const updated = normalizeUser(res?.data?.user || res?.data || payload);
      setUser((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      setSuccess(true);
      setMessage(t("profile:updateSuccess") || "Profile updated successfully.");
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "";
      setSuccess(false);
      setMessage(
        (status === 401 &&
          (t("profile:authRequired") || "Authentication required.")) ||
          serverMsg ||
          (t("profile:updateError") || "Failed to update profile.")
      );
    }
  };

  // Initial fetch + react to authUser changes (multi-session safe)
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setMessage("");

      try {
        let resolvedUser = null;

        // If own profile and we have authUser from context, use it as baseline
        if (!userIdParam && authUser) {
          resolvedUser = normalizeUser(authUser);
        }

        // Always hit backend once as source of truth (with correct token)
        const apiPath = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(apiPath);
        const fromApi = normalizeUser(res?.data?.user || res?.data);

        // Prefer API payload, but fall back to authUser-based normalization if needed
        resolvedUser = fromApi || resolvedUser;

        if (!mounted) return;
        setUser(resolvedUser);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        const status = err?.response?.status;
        setLoading(false);
        setMessage(
          (status === 401 &&
            (t("profile:authRequired") || "Authentication required.")) ||
            t("profile:loadError") ||
            "Failed to load profile."
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userIdParam, authUserId, authUser, t]);

  // Update document title
  useEffect(() => {
    const baseTitle = t("profile:pageTitle") || "Profile";
    if (user?.username) {
      document.title = `${user.username} — ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [user?.username, t]);

  const profileUserId = userIdParam || user?.id || user?._id || authUserId;

  if (loading) {
    return (
      <div className="text-center py-8" data-cy="UserProfile__loading">
        <span className="text-gray-600">
          {t("common:loading") || "Loading"}
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8 space-y-4" data-cy="UserProfile__empty">
        <span className="block text-red-600">
          {message || t("profile:notFound") || "Profile not found."}
        </span>
        <button
          type="button"
          onClick={refreshUser}
          disabled={reloading}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {reloading
            ? t("common:loading") || "Loading"
            : t("common:retry") || "Retry"}
        </button>
      </div>
    );
  }

  // Server-normalized photos (strings or { url }) → strings.
  // Note: normalizeUser() already used normalizeUserImages, so photos/extraImages
  // are aligned with ExtraPhotosPage / MultiStepPhotoUploader.
  const photosArray = Array.isArray(user.photos)
    ? user.photos.map((item) => extractPhotoSrc(item)).filter(Boolean)
    : [];
  const photosKey = photosArray.map((x) => String(x || "")).join("|");
  const hasPhotos = photosArray.length > 0;

  const displayPhotos = useMemo(() => {
    if (!photosArray.length) return [];
    const avatar = user.profilePicture;
    if (avatar) {
      const avatarStr = String(avatar);
      const idx = photosArray.findIndex((p) => String(p) === avatarStr);
      if (idx > 0) {
        const clone = photosArray.slice();
        const [picked] = clone.splice(idx, 1);
        clone.unshift(picked);
        return clone;
      }
    }
    return photosArray;
  }, [photosKey, user?.profilePicture, photosArray]);

  if (process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line no-console
      console.debug?.(
        "[UserProfile] photos (server-normalized only):",
        photosArray
      );
    } catch {
      /* noop */
    }
  }

  const displayName =
    user?.username ||
    (user?.email ? String(user.email).split("@")[0] : "") ||
    t("profile:anonymous") ||
    "Anonymous";

  return (
    <div className="max-w-3xl mx-auto">
      <h2
        className="text-2xl font-bold text-center mb-6"
        data-cy="UserProfile__title"
      >
        👤{" "}
        {isOwnProfile
          ? t("profile:viewOwn") || "My Profile"
          : t("profile:viewOther") || "Profile"}
      </h2>

      {/* Header card */}
      <div className="bg-white shadow rounded-lg p-5 mb-6">
        <div className="flex items-center gap-4">
          <img
            src={buildImgSrc(user.profilePicture)}
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover border"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />
          <div className="flex-1">
            <div className="text-lg font-semibold">{displayName}</div>
            <div className="text-sm text-gray-600">
              {[user.city, user.region, user.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            {user.politicalIdeology && (
              <div className="text-sm mt-1">
                <strong>
                  {t("profile:politicalIdeology") || "Political ideology"}:
                </strong>{" "}
                {user.politicalIdeology}
              </div>
            )}
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={refreshUser}
              disabled={reloading}
              className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-60"
              title={t("common:refresh") || "Refresh"}
            >
              {reloading
                ? t("common:loading") || "Loading"
                : t("common:refresh") || "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="bg-white shadow rounded-lg p-5 mb-6">
        <h3 className="text-lg font-semibold mb-3">
          {t("profile:photos") || "Photos"}
        </h3>

        {hasPhotos ? (
          <>
            <div className="mb-4">
              <PhotoCarousel photos={displayPhotos} />
            </div>

            <div
              className="grid grid-cols-3 gap-3"
              data-cy="UserProfile__photos"
            >
              {displayPhotos.map((p, idx) => (
                <div
                  key={`${p}-${idx}`}
                  className="w-full h-32 bg-gray-100 rounded overflow-hidden"
                  title={`photo-${idx}`}
                >
                  <img
                    src={buildImgSrc(p)}
                    alt={`photo-${idx}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {t("profile:noPhotos") || "No photos yet."}
            </div>
            {isOwnProfile && (
              <a
                href="/profile/photos"
                className="text-sm text-blue-600 hover:underline"
              >
                {t("profile:addPhotos") || "Add photos"}
              </a>
            )}
          </div>
        )}
      </div>

      {!isOwnProfile ? (
        <PublicInfoCard user={user} t={t} />
      ) : (
        <>
          {message && (
            <div
              className={`mb-4 text-center ${
                success ? "text-green-600" : "text-red-600"
              }`}
              data-cy="UserProfile__message"
            >
              {message}
            </div>
          )}

          <ProfileForm
            key={profileUserId || "own-profile"} // force remount when user changes (multi-session safe)
            userId={profileUserId}
            user={user}
            isPremium={user?.isPremium}
            t={t}
            message={message}
            success={success}
            onUserUpdate={(u) =>
              setUser((prev) => ({
                ...(prev || {}),
                ...(normalizeUser(u) || {}),
              }))
            }
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
};

function PublicInfoCard({ user, t }) {
  return (
    <div
      className="bg-white shadow rounded-lg p-6 space-y-4"
      data-cy="UserProfile__public"
    >
      <h3 className="text-lg font-semibold">
        {t("profile:publicInfo") || "Public information"}
      </h3>

      <div className="space-y-2">
        <p>
          <strong>{t("profile:username") || "Username"}:</strong>{" "}
          {user.username || "-"}
        </p>
        <p>
          <strong>{t("profile:age") || "Age"}:</strong> {user.age ?? "-"}
        </p>
        <p>
          <strong>{t("profile:location") || "Location"}:</strong>{" "}
          {[
            user?.location?.city || user.city,
            user?.location?.region || user.region,
            user?.location?.country || user.country,
          ]
            .filter(Boolean)
            .join(", ") || "-"}
        </p>
        <p>
          <strong>
            {t("profile:politicalIdeology") || "Political ideology"}:
          </strong>{" "}
          {user.politicalIdeology || "-"}
        </p>
      </div>

      <div className="pt-2 text-sm text-gray-500">
        {t("profile:publicDisclaimer") ||
          "Only basic public information is shown."}
      </div>

      {/* // --- REPLACE START: standard content ad slot (inline) --- */}
      <AdGate type="inline" debug={false}>
        <div className="max-w-3xl mx-auto mt-6">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </div>
      </AdGate>
      {/* // --- REPLACE END --- */}
    </div>
  );
}

export default UserProfile;
// --- REPLACE END ---



