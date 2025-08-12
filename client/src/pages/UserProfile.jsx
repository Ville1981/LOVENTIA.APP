// --- REPLACE START: add i18n support and keep full structure ---
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/profileFields/ProfileForm";
import api from "../utils/axiosInstance";

const UserProfile = () => {
  const { t } = useTranslation();
  const { userId: userIdParam } = useParams();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (data) => {
    try {
      await api.put("/users/profile", data);
      setSuccess(true);
      setMessage(t("profile.updateSuccess"));
      setUser((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error("❌ Update failed", err);
      setSuccess(false);
      setMessage(t("profile.updateError"));
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const apiPath = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(apiPath);
        const u = res.data.user || res.data;
        setUser(u);
      } catch (err) {
        console.error("❌ Fetch failed", err);
        setMessage(t("profile.loadError"));
      }
    };
    fetchUser();
  }, [userIdParam, t]);

  const profileUserId = userIdParam || user?._id;

  if (!user) {
    return (
      <div className="text-center py-8" data-cy="UserProfile__loading">
        <span className="text-gray-600">{t("loading")}</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2
        className="text-2xl font-bold text-center mb-6"
        data-cy="UserProfile__title"
      >
        👤 {userIdParam ? t("profile.viewOther") : t("profile.viewOwn")}
      </h2>

      {userIdParam ? (
        <div
          className="bg-white shadow rounded-lg p-6 space-y-4"
          data-cy="UserProfile__public"
        >
          <h3 className="text-lg font-semibold">
            {t("profile.publicInfo")}
          </h3>
          <p>
            <strong>{t("profile.username")}:</strong> {user.username}
          </p>
          {/* Additional public fields can be displayed here */}
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
            isPremium={user.isPremium}
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
