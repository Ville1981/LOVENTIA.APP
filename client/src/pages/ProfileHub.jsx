import PropTypes from "prop-types";
import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import ProfileForm from "../components/profileFields/ProfileForm";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";

/**
 * ProfileHub handles user profile display and editing,
 * including profile completion stats, question prompts,
 * and delegates image upload/delete to ProfileForm.
 * Tab navigation is commented out; only “Preferences” renders.
 */
export default function ProfileHub() {
  // --- REPLACE START: prefer 'accessToken' but keep backward compatibility with 'token' ---
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
  // --- REPLACE END ---

  const { userId: userIdParam } = useParams();

  // NOTE: Some installs expose { user, setUser } and others { authUser, setAuthUser }.
  // We keep the original names used by this file but guard function calls below.
  const { user: authUser, setUser: setAuthUser } = useAuth();

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

  // Simple translation stub
  const t = (key) => {
    const translations = {
      "profile.saved": "Profile saved",
      "profile.saveChanges": "Save changes",
    };
    return translations[key] || key;
  };

  // --- REPLACE START: fetch user and populate values + guard setAuthUser existence ---
  const fetchUser = useCallback(async () => {
    try {
      const url = userIdParam
        ? `${BACKEND_BASE_URL}/api/users/${userIdParam}`
        : `${BACKEND_BASE_URL}/api/users/profile`;

      const res = await api.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Server may return { user: {...} } or a raw user object
      const u = res.data?.user ?? res.data;
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
  }, [token, userIdParam, setAuthUser]);
  // --- REPLACE END ---

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!user) {
    return <div className="text-center mt-12">Loading profile…</div>;
  }

  const profileUserId = userIdParam || authUser?._id || user._id || user.id;

  // --- REPLACE START: handle form submit to PUT /api/users/profile and guard setAuthUser ---
  const handleFormSubmit = async (formData) => {
    if (userIdParam) return; // no editing others

    try {
      const res = await api.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        formData,
        {
          // Let axios/browser set proper Content-Type for FormData automatically
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const updated = res.data?.user ?? res.data;
      setSuccess(true);
      setMessage(t("profile.saved"));
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
  // --- REPLACE END ---

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Manage Photos button */}
      <div className="flex justify-end">
        <Link
          to="/profile/photos"
          className="flex items-center px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 text-2xl font-bold"
          data-cy="ProfileHub__photosButton"
        >
          <i className="i-pencil mr-3 text-2xl" aria-hidden="true" />
          Manage Photos
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
    </div>
  );
}

ProfileHub.propTypes = {
  // no props expected
};
