import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import ProfileForm from "../components/profileFields/ProfileForm";
import { BACKEND_BASE_URL } from "../config";

/**
 * ProfileHub handles user profile display and editing,
 * including tab navigation, profile completion stats,
 * question prompts, and delegates image upload/delete to ProfileForm.
 */
const ProfileHub = () => {
  const token = localStorage.getItem("token");
  const { userId: userIdParam } = useParams();

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("preferences");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Stats for profile completion
  const [profileCompletion] = useState(60);
  const [questionsAnswered] = useState(15);
  const [highestMatch] = useState(93);

  // Form values for profile editing
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
    religion: "",
    religionImportance: "",
    children: "",
    pets: "",
    summary: "",
    goal: "",
    lookingFor: ""
  });

  const t = (key) => {
    const translations = {
      "profile.saved": "Profiili tallennettu",
      "profile.saveChanges": "Tallenna muutokset"
    };
    return translations[key] || key;
  };

  // Fetch current user or viewed user's data
  const fetchUser = useCallback(async () => {
    try {
      const url = userIdParam
        ? `${BACKEND_BASE_URL}/api/users/${userIdParam}`
        : `${BACKEND_BASE_URL}/api/auth/me`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const u = res.data.user || res.data;
      setUser(u);

      // Populate form values if viewing own profile
      if (!userIdParam) {
        setValues({
          username: u.username || "",
          email: u.email || "",
          age: u.age || "",
          gender: u.gender || "",
          orientation: u.orientation || "",
          country: u.country || "",
          region: u.region || "",
          city: u.city || "",
          customCountry: "",
          customRegion: "",
          customCity: "",
          education: u.education || "",
          profession: u.profession || "",
          religion: u.religion || "",
          religionImportance: u.religionImportance || "",
          children: u.children || "",
          pets: u.pets || "",
          summary: u.summary || "",
          goal: u.goal || "",
          lookingFor: u.lookingFor || ""
        });
      }
    } catch (err) {
      console.error("Profiilin haku epäonnistui:", err);
    }
  }, [token, userIdParam]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Handle profile form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userIdParam) return; // Do not submit when viewing another's profile
    try {
      await axios.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        values,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(true);
      setMessage("Profiilitiedot päivitetty onnistuneesti.");
      setUser((u) => ({ ...u, ...values }));
    } catch (err) {
      console.error("Päivitys epäonnistui:", err);
      setSuccess(false);
      setMessage("Profiilitietojen päivitys epäonnistui.");
    }
  };

  if (!user) {
    return <div className="text-center mt-12">Ladataan profiilia…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Tab navigation */}
      <div className="flex bg-gray-900 rounded-lg overflow-hidden">
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex-1 py-2 text-center font-medium ${
            activeTab === "preferences"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}>
          Preferences
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-2 text-center font-medium ${
            activeTab === "settings"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}>
          Settings
        </button>
      </div>

      {/* Preferences tab */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Completion progress */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-2">Steps to success</h2>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-pink-500"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Complete your profile to be seen more & get more matches!
            </p>
          </div>

          {/* Answer more questions */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-2">Answer More Questions</h2>
            <div className="flex items-center space-x-4">
              <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-pink-500"
                  style={{ width: `${(questionsAnswered / 500) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-pink-500">
                {questionsAnswered}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Your highest possible match: <span className="font-bold">{highestMatch}%</span>
            </p>
            <div className="mt-4 flex space-x-2">
              <button className="flex-1 py-2 border border-blue-600 rounded-lg">
                NO
              </button>
              <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg">
                YES
              </button>
            </div>
            <div className="mt-2 text-center">
              <button className="text-sm text-gray-500 underline">Skip</button>
              {" • "}
              <Link to="/questions/answered" className="text-sm text-blue-600">
                See answered questions
              </Link>
            </div>
          </div>

          {/* Profile form */}
          <ProfileForm
            user={user}
            onUserUpdate={(u) => setUser(u)}
            isPremium={user.isPremium}
            values={values}
            setters={setValues}
            t={t}
            message={message}
            success={success}
            hideAvatarSection={false}
          />
        </div>
      )}

      {/* Settings tab */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-xl">Settings</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/settings/account" className="text-blue-600 hover:underline">
                Account settings
              </Link>
            </li>
            <li>
              <Link to="/settings/notifications" className="text-blue-600 hover:underline">
                Notification preferences
              </Link>
            </li>
            <li>
              <Link to="/settings/privacy" className="text-blue-600 hover:underline">
                Privacy & blocked profiles
              </Link>
            </li>
            <li>
              <Link to="/settings/subscriptions" className="text-blue-600 hover:underline">
                Subscriptions & billing
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProfileHub;
