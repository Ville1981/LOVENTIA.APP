// File: client/src/components/profile/ProfileDetails.jsx

// --- REPLACE START: use centralized axios instance & align endpoint with server (/api/users/profile) ---
import axios from "../../utils/axiosInstance";
// const BACKEND_BASE_URL = "http://localhost:5000"; // not needed when using axiosInstance
// --- REPLACE END ---
import React, { useState, useEffect } from "react";

/**
 * ProfileDetails
 *
 * Handles editing of legacy profile fields.
 * Props:
 *  - user: user data, contains user.id and user.profile
 *  - onUpdate: callback receiving updated user data
 */
const ProfileDetails = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState({
    aboutMe: "",
    currentGoal: "",
    talents: "",
    // …add other fields as needed, e.g., traits, hobbies, etc.
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill form using profile data fetched earlier
    if (user?.profile) {
      setFormData({
        aboutMe: user.profile.aboutMe || "",
        currentGoal: user.profile.currentGoal || "",
        talents: user.profile.talents || "",
        // …pre-fill other fields similarly
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Using axiosInstance baseURL (/api) + users route + PUT /profile (no userId in URL; server resolves from token)
      // Authorization header is injected automatically by axiosInstance if accessToken is set.
      // --- REPLACE START: switch to /api/users/profile and rely on axiosInstance auth header ---
      const response = await axios.put("/api/users/profile", formData);
      // --- REPLACE END ---
      if (typeof onUpdate === "function") {
        onUpdate(response.data);
      }
    } catch (err) {
      console.error("Profile update failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-4 space-y-4"
    >
      <h3 className="text-lg font-semibold">Profile details</h3>

      <div>
        <label className="block font-medium">About Me</label>
        <textarea
          name="aboutMe"
          value={formData.aboutMe}
          onChange={handleChange}
          className="w-full border rounded p-2"
          rows={4}
        />
      </div>

      <div>
        <label className="block font-medium">Current Goal</label>
        <input
          type="text"
          name="currentGoal"
          value={formData.currentGoal}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block font-medium">Talents</label>
        <input
          type="text"
          name="talents"
          value={formData.talents}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />
      </div>

      {/* Add additional fields here in the same manner if needed */}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white py-2 px-4 rounded"
      >
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
};

export default ProfileDetails;
