// --- ensure AuthContext + axios paths and guard setAuthUser ---
import PropTypes from "prop-types";
import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/profileFields/ProfileForm";
// NOTE: Remove BACKEND_BASE_URL usage for profile calls â€“ we centralize via userService
// import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
// import api from "../services/api/axiosInstance";
import { getUserProfile, updateOwnProfile } from "../services/userService";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";


/**
 * ProfileHub handles user profile display and editing,
 * including profile completion stats, question prompts,
 * and delegates image upload/delete to ProfileForm.
 * Tab navigation is commented out; only â€œPreferencesâ€ renders.
 */
export default function ProfileHub() {
  // i18n-kÃ¤Ã¤nnÃ¶kset: kÃ¤ytÃ¤ oikeaa t-funktiota, EI omaa stubia
  const { t } = useTranslation(["profile", "common", "discover", "lifestyle"]);

  // Prefer context-managed user (axios instance sets header); legacy localStorage not needed
  // const legacyToken =
  //   localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

  const { userId: userIdParam } = useParams();

  const {
    user: authUser,
    setUser: setAuthUser, // our context provides this; keep exact name
  } = useAuth();

  // --- local state ---
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Form default values
  const [values, setValues] = useState({
    username: "",
    email: "",
    age: "",
    gender: "",
    orientation: "",
    country: "",
    region: "",
    city: "",
    customCountry: "",
    customRegion: "",
    customCity: "",
    education: "",
    profession: "",
    professionCategory: "",
    religion: "",
    religionImportance: "",
    children: "",
    pets: "",
    summary: "",
    goal: "",
    lookingFor: "",
    smoke: "",
    drink: "",
    drugs: "",
    height: null,
    heightUnit: "",
    weight: null,
    bodyType: "",
    activityLevel: "",
    nutritionPreferences: [],
    healthInfo: "",
    latitude: null,
    longitude: null,
  });
  // --- end local state ---

  const fetchUser = useCallback(async () => {
    try {
      // use centralized userService (api instance attaches Bearer automatically)
      const res = await getUserProfile(userIdParam);
      // Server may return { user: {...} } or a raw user object
      const u = res?.user ?? res;

      setUser(u);

      if (!userIdParam && typeof setAuthUser === "function") {
        setAuthUser(u);
      }

      setValues({
        username: u.username || "",
        email: u.email || "",
        age: u.age || "",
        gender: u.gender || "",
        orientation: u.orientation || "",
        country: u.country || "",
        region: u.region || "",
        city: u.city || "",
        customCountry: u.customCountry || "",
        customRegion: u.customRegion || "",
        customCity: u.customCity || "",
        education: u.education || "",
        profession: u.profession || "",
        professionCategory: u.professionCategory || "",
        religion: u.religion || "",
        religionImportance: u.religionImportance || "",
        children: u.children || "",
        pets: u.pets || "",
        summary: u.summary || "",
        goal: u.goal || "",
        lookingFor: u.lookingFor || "",
        smoke: u.smoke || "",
        drink: u.drink || "",
        drugs: u.drugs || "",
        height: u.height ?? null,
        heightUnit: u.heightUnit || "",
        weight: u.weight ?? null,
        bodyType: u.bodyType || "",
        activityLevel: u.activityLevel || "",
        nutritionPreferences: Array.isArray(u.nutritionPreferences)
          ? u.nutritionPreferences
          : [],
        healthInfo: u.healthInfo || "",
        latitude: u.latitude ?? null,
        longitude: u.longitude ?? null,
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setMessage("Failed to load profile.");
      setSuccess(false);
    }
  }, [userIdParam, setAuthUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!user) {
    return <div className="text-center mt-12">Loading profileâ€¦</div>;
  }

  const profileUserId = userIdParam || authUser?._id || user._id || user.id;

  const handleFormSubmit = async (formData) => {
    if (userIdParam) return; // no editing others

    try {
      // centralized update via userService (api sets headers)
      const updated = await updateOwnProfile(formData);

      setSuccess(true);
      // Prefer localized message if available
      setMessage(
        t("profile:saved") || t("profile:saveChanges") || "Profile saved"
      );
      setUser(updated);
      if (typeof setAuthUser === "function") {
        setAuthUser(updated);
      }
    } catch (err) {
      console.error("Update failed:", err);
      let msg = err.message;
      const resp = err.response?.data;
      if (resp) {
        if (resp.message) msg = resp.message;
        else if (Array.isArray(resp.errors)) {
          msg = resp.errors.map((e) => e.msg).join(", ");
        } else if (resp.error) {
          msg = resp.error;
        }
      }
      setSuccess(false);
      setMessage(msg);
    }
  };

  return (
  <>
      {/* <HeaderAdSlot className="max-w-6xl mx-auto px-4" /> */}

    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Manage Photos button */}
      <div className="flex justify-end">
        <Link
          to="/profile/photos"
          className="flex items-center px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 text-2xl font-bold"
          data-cy="ProfileHub__photosButton"
        >
          <i className="i-pencil mr-3 text-2xl" aria-hidden="true" />
          {t("profile:managePhotos") || "Manage Photos"}
        </Link>
      </div>

      {/* Profile form */}
      <ProfileForm
        userId={profileUserId}
        user={user}
        onUserUpdate={(u) => {
          setUser(u);
          if (typeof setAuthUser === "function") {
            setAuthUser(u);
          }
        }}
        isPremium={user.isPremium}
        t={t}
        message={message}
        success={success}
        onSubmit={handleFormSubmit}
        hidePhotoSection
        defaultValues={values}
      />
    
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
    </>
);
}

ProfileHub.propTypes = {
  // no props expected
};




