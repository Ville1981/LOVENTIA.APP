// client/src/pages/UserProfile.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import ProfileForm from "../components/profileFields/ProfileForm";  // profiilin muokkauslomake

// Tämä osoite pitää vastata backendisi URL:ia
const BACKEND_BASE_URL = "http://localhost:5000";

const UserProfile = () => {
  const token = localStorage.getItem("token");
  const { userId: userIdParam } = useParams();

  // Käyttäjädata ja status-viestit
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Lomakkeen kenttätilat (vain oman profiilin muokkaukseen)
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

  // Stub-käännösfunktio (ProfileForm tarvitsee prop t)
  const t = (key) => {
    const translations = {
      "profile.saveAvatar": "Tallenna profiilikuva",
      "profile.saveChanges": "Tallenna muutokset",
      "profile.country": "Maa",
      "profile.region": "Osavaltio",
      "profile.city": "Kaupunki",
      "profile.selectCountry": "Valitse maa",
      "profile.selectRegion": "Valitse osavaltio",
      "profile.selectCity": "Valitse kaupunki",
      "profile.manualCountry": "Tai kirjoita maa…",
      "profile.manualRegion": "Tai kirjoita osavaltio…",
      "profile.manualCity": "Tai kirjoita kaupunki…",
    };
    return translations[key] || key;
  };

  // 1) Haetaan data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const url = userIdParam
          ? `${BACKEND_BASE_URL}/api/users/${userIdParam}`
          : `${BACKEND_BASE_URL}/api/auth/me`;
        const res = await axios.get(url, {
          headers: userIdParam
            ? { Authorization: `Bearer ${token}` }
            : { Authorization: `Bearer ${token}` },
        });
        const u = res.data.user || res.data;
        setUser(u);

        // Esitä nykyiset arvot muokkauslomakkeessa vain oman profiilin kohdalla
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
        setUser({ username: "Tuntematon käyttäjä", gender: "male" });
      }
    };

    fetchUser();
  }, [token, userIdParam]);

  // 2) Oman profiilin päivitys
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userIdParam) return; // älä päivitä vieraan profiilia

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
      await axios.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(true);
      setMessage("Profiilitiedot päivitetty onnistuneesti.");
    } catch (err) {
      console.error("❌ Päivitys epäonnistui", err);
      setSuccess(false);
      setMessage("Profiilitietojen päivitys epäonnistui.");
    }
  };

  // Propsit ProfileForm-komponentille
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
    handleSubmit, // tärkeä: ProfileForm kutsuu tätä lopulliseen tallennukseen
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">
        👤 {userIdParam ? "Käyttäjän profiili" : "Oma profiili"}
      </h2>

      {!user ? (
        <div className="text-center py-8">
          <span className="text-gray-600">Ladataan…</span>
        </div>
      ) : userIdParam ? (
        // Read-only-näyttö vieraan profiilissa
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Tietoja käyttäjästä</h3>
          <p><strong>Käyttäjätunnus:</strong> {user.username}</p>
          <p><strong>Sähköposti:</strong> {user.email}</p>
          <p><strong>Ikä:</strong> {user.age}</p>
          <p><strong>Sukupuoli:</strong> {user.gender}</p>
          <p><strong>Suuntautuminen:</strong> {user.orientation}</p>
          <p><strong>Sijainti:</strong> {user.city}, {user.region}, {user.country}</p>
          <p><strong>Esittely:</strong> {user.summary}</p>
          <p><strong>Tavoitteet:</strong> {user.goal}</p>
          <p><strong>Etsin:</strong> {user.lookingFor}</p>
        </div>
      ) : (
        // Oman profiilin muokkaus
        <>
          {message && (
            <div className={`mb-4 text-center ${success ? "text-green-600" : "text-red-600"}`}>
              {message}
            </div>
          )}
          <ProfileForm
            user={user}
            onUserUpdate={(u) => setUser(u)}
            isPremium={user.isPremium}
            values={values}
            setters={setters}
            message={message}
            success={success}
            t={t}
          />
        </>
      )}
    </div>
  );
};

export default UserProfile;
