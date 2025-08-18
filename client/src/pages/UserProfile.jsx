// client/src/pages/UserProfile.jsx

// --- REPLACE START: add i18n support, robust submit/fetch, and keep full structure ---
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/profileFields/ProfileForm";
// Use the unified axios instance (handles Authorization + refresh)
import api from "../services/api/axiosInstance";

const UserProfile = () => {
  // Load the common namespaces used on the profile page
  const { t } = useTranslation(["common", "profile", "lifestyle"]);

  const { userId: userIdParam } = useParams();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (data) => {
    // Reset UI state before submit
    setMessage("");
    setSuccess(false);

    // Debug: verify the submit path is reached from ProfileForm
    console.log("[UserProfile] PUT /users/profile payload:", data);

    try {
      const res = await api.put("/users/profile", data);
      // Prefer server response (may contain normalized values)
      const updated = res?.data?.user || data;
      setUser((prev) => ({ ...(prev || {}), ...(updated || {}) }));

      setSuccess(true);
      // Translation key with safe fallback
      setMessage(t("profile.updateSuccess") || "Profile updated successfully.");
      console.info("✅ Profile updated:", res?.data);
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;

      console.error("❌ Update failed:", status, serverMsg, err);

      setSuccess(false);
      // Show specific message for 401, otherwise generic error
      setMessage(
        (status === 401 &&
          (t("profile.authRequired") || "Authentication required.")) ||
          t("profile.updateError") ||
          "Failed to update profile."
      );
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      setMessage("");
      try {
        const apiPath = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(apiPath);
        const u = res?.data?.user || res?.data;
        setUser(u);
      } catch (err) {
        const status = err?.response?.status;
        console.error("❌ Fetch failed:", status, err?.message, err);
        setMessage(
          (status === 401 &&
            (t("profile.authRequired") || "Authentication required.")) ||
            t("profile.loadError") ||
            "Failed to load profile."
        );
      }
    };

    fetchUser();
    // Do not include `t` in deps to avoid re-fetch on language switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdParam]);

  const profileUserId = userIdParam || user?._id;

  if (!user) {
    return (
      <div className="text-center py-8" data-cy="UserProfile__loading">
        <span className="text-gray-600">
          {t("common.loading") || "Loading"}
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
        {userIdParam
          ? t("profile.viewOther") || "Profile"
          : t("profile.viewOwn") || "My Profile"}
      </h2>

      {userIdParam ? (
        <div
          className="bg-white shadow rounded-lg p-6 space-y-4"
          data-cy="UserProfile__public"
        >
          <h3 className="text-lg font-semibold">
            {t("profile.publicInfo") || "Public information"}
          </h3>
          <p>
            <strong>{t("profile.username") || "Username"}:</strong>{" "}
            {user.username}
          </p>
          {/* Keep space for additional public fields if needed later */}
        </div>
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
            userId={profileUserId}
            user={user}
            isPremium={user?.isPremium}
            t={t}
            message={message}
            success={success}
            onUserUpdate={setUser}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
};

export default UserProfile;
// --- REPLACE END ---
