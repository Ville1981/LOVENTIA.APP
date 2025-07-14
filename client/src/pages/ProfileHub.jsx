import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../utils/axiosInstance";
import { useAuth } from "../context/AuthContext";
import ProfileForm from "../components/profileFields/ProfileForm";
import { BACKEND_BASE_URL } from "../config";

/**
 * ProfileHub handles user profile display and editing,
 * including profile completion stats, question prompts,
 * and delegates image upload/delete to ProfileForm.
 * Tab navigation is commented out, only the Preferences
 * tab (profile form) renders.
 */
const ProfileHub = () => {
  const token = localStorage.getItem("token");
  const { userId: userIdParam } = useParams();
  const { user: authUser, setUser: setAuthUser } = useAuth();

  // --- paikalliset statet ---
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("preferences");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Lomakkeen kentät (initial defaultValues)
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

  // Profiilin edistymis‐statistiikat
  const [profileCompletion] = useState(60);
  const [questionsAnswered] = useState(15);
  const [highestMatch] = useState(93);

  // Yksinkertainen käännös-funktio
  const t = (key) => {
    const translations = {
      "profile.saved": "Profiili tallennettu",
      "profile.saveChanges": "Tallenna muutokset",
    };
    return translations[key] || key;
  };

  // --- käyttäjätiedon haku ---
  const fetchUser = useCallback(async () => {
    try {
      const url = userIdParam
        ? `${BACKEND_BASE_URL}/api/users/${userIdParam}`
        : `${BACKEND_BASE_URL}/api/users/profile`;

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const u = res.data.user || res.data;
      setUser(u);

      // jos oma profiili, päivitä myös AuthContext ja lomakkeen default-arvot
      if (!userIdParam) {
        setAuthUser(u);
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
          height: u.height || null,
          heightUnit: u.heightUnit || "",
          weight: u.weight || null,
          bodyType: u.bodyType || "",
          activityLevel: u.activityLevel || "",
          nutritionPreferences: Array.isArray(u.nutritionPreferences)
            ? u.nutritionPreferences
            : [],
          healthInfo: u.healthInfo || "",
          latitude: u.latitude || null,
          longitude: u.longitude || null,
        });
      }
    } catch (err) {
      console.error("Profiilin haku epäonnistui:", err);
      setMessage("Profiilin haku epäonnistui");
      setSuccess(false);
    }
  }, [token, userIdParam, setAuthUser]);

  // Haetaan data heti latautuessa
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!user) {
    return <div className="text-center mt-12">Ladataan profiilia…</div>;
  }

  // Käytetään joko paramia tai omaa token‐käyttäjää
  const profileUserId =
    userIdParam || authUser?._id || user._id || user.id;

  // Lomakkeen lähetysfunktio (muodossa FormData)
  const handleFormSubmit = async (formData) => {
    if (userIdParam) return; // ei salli toisen profiilin muokkausta

    try {
      const res = await api.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updated = res.data.user || res.data;
      setSuccess(true);
      setMessage(t("profile.saved"));
      setUser(updated);
      setAuthUser(updated);
    } catch (err) {
      console.error("Päivitys epäonnistui:", err);

      // yritä näyttää backendin virheilmoitukset
      const resp = err.response?.data;
      let msg = err.message;
      if (resp) {
        if (resp.message) msg = resp.message;
        else if (Array.isArray(resp.errors)) {
          msg = resp.errors.map(e => e.msg).join(", ");
        }
      }

      setSuccess(false);
      setMessage(msg);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Tab‐napit (poistettu käytöstä) */}
      {/**
      <div className="flex bg-gray-900 rounded-lg overflow-hidden">
        …
      </div>
      **/}

      {/* Preferences‐välilehden sisältö */}
      <div className="space-y-6">
        {/* Manage Photos -nappi */}
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

        {/* ProfileForm vastaa lomakkeen kentistä ja avatarista */}
        <ProfileForm
          userId={profileUserId}
          user={user}
          onUserUpdate={(u) => {
            setUser(u);
            setAuthUser(u);
          }}
          isPremium={user.isPremium}
          t={t}
          message={message}
          success={success}
          onSubmit={handleFormSubmit}
          hidePhotoSection={true}
          defaultValues={values}
        />
      </div>
    </div>
  );
};

export default ProfileHub;



