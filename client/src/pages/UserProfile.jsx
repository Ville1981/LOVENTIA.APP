// src/pages/UserProfile.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import "../styles/ads.css";
import ProfileForm from "../components/profileFields/ProfileForm";

// Tämä BACKEND_BASE_URL pitää vastata backendisi osoitetta (portti 5000 oletuksena)
const BACKEND_BASE_URL = "http://localhost:5000";

const UserProfile = () => {
  const token = localStorage.getItem("token");
  const { userId: userIdParam } = useParams();

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Lomakkeen kenttätilat (vain oma profiili)
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [orientation, setOrientation] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [education, setEducation] = useState("");
  const [profession, setProfession] = useState("");
  const [religion, setReligion] = useState("");
  const [religionImportance, setReligionImportance] = useState("");
  const [children, setChildren] = useState("");
  const [pets, setPets] = useState("");
  const [summary, setSummary] = useState("");
  const [goal, setGoal] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  // Kuva‐upload tilat
  const [newImageFile, setNewImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Stub-käännösfunktio (ProfileForm tarvitsee prop t)
  const t = (key) => {
    const translations = {
      "profile.saved": "Profiili tallennettu",
      "profile.saveChanges": "Tallenna muutokset",
    };
    return translations[key] || key;
  };

  // CSS‐luokan nimi kehystetyille avatar‐kuville
  const avatarContainerClass =
    "w-32 h-32 rounded-full overflow-hidden border-2 border-gray-400 bg-gray-100";

  // 1) Haetaan joko oman profiilin tiedot tai toisen käyttäjän profiili
  useEffect(() => {
    const fetchUser = async () => {
      try {
        let res;

        if (userIdParam) {
          // Hae toisen käyttäjän profiili
          res = await axios.get(
            `${BACKEND_BASE_URL}/api/users/${userIdParam}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        } else {
          // Hae oma profiili
          res = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        const u = res.data.user || res.data;
        setUser(u);

        if (!userIdParam) {
          setUsername(u.username || "");
          setEmail(u.email || "");
          setAge(u.age || "");
          setGender(u.gender || "");
          setOrientation(u.orientation || "");
          setCountry(u.country || "");
          setRegion(u.region || "");
          setCity(u.city || "");
          setCustomCountry("");
          setCustomRegion("");
          setCustomCity("");
          setEducation(u.education || "");
          setProfession(u.profession || "");
          setReligion(u.religion || "");
          setReligionImportance(u.religionImportance || "");
          setChildren(u.children || "");
          setPets(u.pets || "");
          setSummary(u.summary || "");
          setGoal(u.goal || "");
          setLookingFor(u.lookingFor || "");
        }
      } catch (err) {
        console.error("❌ Profiilin haku epäonnistui", err);
        setMessage("Profiilin lataus epäonnistui.");

        // Dummy‐fallback: asetetaan selkeästi username ja gender,
        // niin näytetään musta placeholder‐teksti ja harmaa siluetti.
        setUser({
          username: "Tuntematon käyttäjä",
          gender: "male",
        });
      }
    };

    fetchUser();
  }, [token, userIdParam]);

  // 2) Oma profiili päivitys (vain oma profiili)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userIdParam) return;

    try {
      const payload = {
        username,
        email,
        age,
        gender,
        orientation,
        country: country || customCountry,
        region: region || customRegion,
        city: city || customCity,
        education,
        profession,
        religion,
        religionImportance,
        children,
        pets,
        summary,
        goal,
        lookingFor,
      };

      // Korjattu polku: '/api/users/profile'
      await axios.put(`${BACKEND_BASE_URL}/api/users/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess(true);
      setMessage("Profiilitiedot päivitetty onnistuneesti.");
    } catch (err) {
      console.error("❌ Päivitys epäonnistui", err);
      setSuccess(false);
      setMessage("Profiilitietojen päivitys epäonnistui.");
    }
  };

  // 3) Kuvan upload (vain oma profiili)
  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (!newImageFile || !user || userIdParam) return;

    setUploading(true);
    setMessage("");
    setSuccess(false);

    const formData = new FormData();
    formData.append("profilePhoto", newImageFile);

    try {
      const res = await axios.post(
        `${BACKEND_BASE_URL}/api/users/${user._id}/upload-avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updatedUser = res.data.user || res.data;
      setUser(updatedUser);

      setSuccess(true);
      setMessage("Kuva ladattu onnistuneesti.");
    } catch (err) {
      console.error("❌ Kuvan lataus epäonnistui", err);
      setSuccess(false);
      setMessage("Kuvan lataus epäonnistui.");
    } finally {
      setUploading(false);
    }
  };

  // 4) getAvatarUrl: backendin profiilikuva tai sukupuolen perusteella oikea placeholder
  const getAvatarUrl = () => {
    if (user && user.profilePicture) {
      const photo = user.profilePicture;
      if (photo.startsWith("http://") || photo.startsWith("https://")) {
        return photo;
      }
      // Muodostetaan URL staattisesta upload-kansiosta
      return `${BACKEND_BASE_URL}/${photo}`;
    }

    if (user?.gender && user.gender.toLowerCase().startsWith("f")) {
      return "/placeholder-avatar-female.png";
    }

    return "/placeholder-avatar-male.png";
  };

  // Lomaketiedot (vain oma profiili)
  const values = {
    username,
    email,
    age,
    gender,
    orientation,
    country,
    region,
    city,
    customCountry,
    customRegion,
    customCity,
    education,
    profession,
    religion,
    religionImportance,
    children,
    pets,
    summary,
    goal,
    lookingFor,
  };

  const setters = {
    setUsername,
    setEmail,
    setAge,
    setGender,
    setOrientation,
    setCountry,
    setRegion,
    setCity,
    setCustomCountry,
    setCustomRegion,
    setCustomCity,
    setEducation,
    setProfession,
    setReligion,
    setReligionImportance,
    setChildren,
    setPets,
    setSummary,
    setGoal,
    setLookingFor,
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-center mb-4">
        👤 {userIdParam ? "Käyttäjän profiili" : "Oma profiili"}
      </h2>

      {!user ? (
        // Jos user on null, odotetaan fetchiä
        <div className="text-center py-8">
          <span className="text-gray-600">Ladataan…</span>
        </div>
      ) : (
        <>
          {/* -- Kehystetty avatar + käyttäjänimi */}
          <div className="flex flex-col items-center mb-6">
            <div className={avatarContainerClass}>
              <img
                src={getAvatarUrl()}
                alt={`${user.username} profiilikuva`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  // Jos mikään ei lataudu, näytetään aina mies‐placeholder
                  e.currentTarget.src = "/placeholder-avatar-male.png";
                }}
              />
            </div>
            <span className="mt-2 text-gray-700">
              {user.username || "Tuntematon käyttäjä"}
            </span>
          </div>

          {userIdParam ? (
            // --- Toisen käyttäjän profiili (vain luku)
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Tietoja käyttäjästä</h3>
              <div className="space-y-2 text-gray-800">
                <p>
                  <span className="font-semibold">Sähköposti:</span> {user.email}
                </p>
                <p>
                  <span className="font-semibold">Ikä:</span> {user.age}
                </p>
                <p>
                  <span className="font-semibold">Sukupuoli:</span> {user.gender}
                </p>
                <p>
                  <span className="font-semibold">Suuntautuminen:</span> {user.orientation}
                </p>
                <p>
                  <span className="font-semibold">Sijainti:</span> {user.city}, {user.region},{" "}
                  {user.country}
                </p>
                <p>
                  <span className="font-semibold">Esittely:</span> {user.summary}
                </p>
                <p>
                  <span className="font-semibold">Tavoitteet:</span> {user.goal}
                </p>
                <p>
                  <span className="font-semibold">Etsin:</span> {user.lookingFor}
                </p>
                {/* Lisää kenttiä halutessasi */}
              </div>
            </div>
          ) : (
            // --- Oma profiili (muokkaus + upload)
            <>
              {/* Kuvan latauslomake */}
              <div className="bg-white shadow rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold mb-2">
                  Päivitä profiilikuva
                </h3>
                <form
                  onSubmit={handleImageUpload}
                  className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setNewImageFile(e.target.files[0]);
                      setMessage("");
                      setSuccess(false);
                    }}
                    className="block w-full sm:w-auto text-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {uploading ? "Ladataan kuvaa…" : "Lataa kuva"}
                  </button>
                </form>
              </div>

              {/* Virheilmoitukset / onnistumisilmoitukset */}
              {message && (
                <div
                  className={`mb-4 text-center ${
                    success ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {message}
                </div>
              )}

              {/* Profiilitiedot (muokattava lomake) */}
              <ProfileForm
                values={values}
                setters={setters}
                handleSubmit={handleSubmit}
                message={message}
                success={success}
                t={t} // lisätty prop t
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default UserProfile;
