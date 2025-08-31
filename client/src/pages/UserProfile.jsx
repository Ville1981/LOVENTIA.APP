// File: client/src/pages/UserProfile.jsx

// --- REPLACE START: add i18n support, robust submit/fetch, and keep full structure ---
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/profileFields/ProfileForm";
// Unified axios instance (adds Authorization, handles refresh, baseURL=/api)
import api from "../services/api/axiosInstance";

/**
 * Helper: normalize user payload coming from server (defensive).
 * Keeps future compatibility and ensures we never crash on missing fields.
 */
function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;

  // Prefer normalized server shape (id, photos, profilePicture, visibility etc.)
  const id = String(u.id || u._id || "");
  const photos = Array.isArray(u.photos)
    ? u.photos
    : Array.isArray(u.extraImages)
    ? u.extraImages
    : [];
  const profilePicture = u.profilePicture || null;

  // Location flattening (server may send either nested location or flat fields)
  const location = u.location && typeof u.location === "object" ? u.location : {};
  const country = u.country || location.country || null;
  const region = u.region || location.region || null;
  const city = u.city || location.city || null;

  // Premium flags are mirrored on server, keep both for UI that checks either
  const isPremium =
    !!u.isPremium || !!u.premium || (u.entitlements && u.entitlements.tier === "premium");

  return {
    ...u,
    id,
    _id: id || u._id, // retain _id in case components reference it
    photos,
    profilePicture,
    country,
    region,
    city,
    isPremium,
  };
}

/**
 * Helper: remap client form values to server schema keys (only when necessary).
 * Especially supports the legacy "ideology" => "politicalIdeology".
 */
function mapOutgoingPayload(values) {
  const out = { ...(values || {}) };
  if (
    (out.politicalIdeology === undefined || out.politicalIdeology === "") &&
    typeof out.ideology !== "undefined"
  ) {
    out.politicalIdeology = out.ideology;
  }
  // Do not send the legacy key to avoid schema warnings
  if (Object.prototype.hasOwnProperty.call(out, "ideology")) {
    delete out.ideology;
  }
  return out;
}

const UserProfile = () => {
  // i18n namespaces used on the profile page
  const { t } = useTranslation(["common", "profile", "lifestyle"]);

  const { userId: userIdParam } = useParams();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // This memoized flag drives whether we show editable form vs public view
  const isOwnProfile = useMemo(() => !userIdParam, [userIdParam]);

  const handleSubmit = async (data) => {
    // Reset UI state before submit
    setMessage("");
    setSuccess(false);

    // Map outgoing payload for backward-compat keys
    const payload = mapOutgoingPayload(data);

    // Debug (visible in dev console)
    console.log("[UserProfile] PUT /users/profile payload:", payload);

    try {
      // NOTE: axiosInstance has baseURL=/api, so this hits /api/users/profile
      const res = await api.put("/users/profile", payload);

      // Server may return either the updated user or the entire normalized me-shape
      const updated = normalizeUser(res?.data?.user || res?.data || payload);
      setUser((prev) => ({ ...(prev || {}), ...(updated || {}) }));

      setSuccess(true);
      setMessage(t("profile:updateSuccess") || "Profile updated successfully.");
      console.info("✅ Profile updated:", res?.data);
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "";

      console.error("❌ Update failed:", status, serverMsg, err);

      setSuccess(false);
      setMessage(
        (status === 401 &&
          (t("profile:authRequired") || "Authentication required.")) ||
          serverMsg ||
          t("profile:updateError") ||
          "Failed to update profile."
      );
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      setLoading(true);
      setMessage("");

      try {
        // With axiosInstance baseURL, these become /api/users/:id or /api/users/me
        const apiPath = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(apiPath);

        // Some endpoints return { user }, some return the document directly
        const u = normalizeUser(res?.data?.user || res?.data);
        if (!mounted) return;

        setUser(u);
        setLoading(false);
      } catch (err) {
        const status = err?.response?.status;
        console.error("❌ Fetch profile failed:", status, err?.message, err);

        if (!mounted) return;
        setLoading(false);
        setMessage(
          (status === 401 &&
            (t("profile:authRequired") || "Authentication required.")) ||
            t("profile:loadError") ||
            "Failed to load profile."
        );
      }
    };

    fetchUser();

    return () => {
      mounted = false;
    };
    // Do not include `t` to avoid re-fetch on language switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdParam]);

  const profileUserId = userIdParam || user?.id || user?._id;

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
      <div className="text-center py-8" data-cy="UserProfile__empty">
        <span className="text-red-600">
          {message || t("profile:notFound") || "Profile not found."}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2
        className="text-2xl font-bold text-center mb-6"
        data-cy="UserProfile__title"
      >
        {/* Keep the original conditional title behavior */}
        👤{" "}
        {isOwnProfile
          ? t("profile:viewOwn") || "My Profile"
          : t("profile:viewOther") || "Profile"}
      </h2>

      {!isOwnProfile ? (
        // Public (read-only) view for other users
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
              <strong>{t("profile:age") || "Age"}:</strong>{" "}
              {user.age ?? "-"}
            </p>
            <p>
              <strong>{t("profile:location") || "Location"}:</strong>{" "}
              {[user.city, user.region, user.country].filter(Boolean).join(", ") || "-"}
            </p>
          </div>

          {/* Reserved for future public fields; keep layout stable */}
          <div className="pt-2 text-sm text-gray-500">
            {t("profile:publicDisclaimer") ||
              "Only basic public information is shown."}
          </div>
        </div>
      ) : (
        // Editable own profile
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
            userId={profileUserId}
            user={user}
            isPremium={user?.isPremium}
            t={t}
            message={message}
            success={success}
            onUserUpdate={(u) => setUser((prev) => ({ ...(prev || {}), ...(u || {}) }))}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
};

export default UserProfile;
// --- REPLACE END ---
