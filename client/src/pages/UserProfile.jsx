import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../utils/axiosInstance";
import ProfileForm from "../components/profileFields/ProfileForm";

const UserProfile = () => {
  const { userId: userIdParam } = useParams();

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Kenttätilat
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
  const [smoke, setSmoke] = useState("");
  const [drink, setDrink] = useState("");
  const [drugs, setDrugs] = useState("");

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
      "lifestyle.smoke": "Tupakointi",
      "lifestyle.drink": "Alkoholi",
      "lifestyle.drugs": "Huumeet",
    };
    return translations[key] || key;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const path = userIdParam ? `/users/${userIdParam}` : "/users/me";
        const res = await api.get(path);
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
          setSmoke(u.smoke || "");
          setDrink(u.drink || "");
          setDrugs(u.drugs || "");
        }
      } catch (err) {
        console.error("❌ Profiilin haku epäonnistui", err);
        setMessage("Profiilin lataus epäonnistui.");
        setUser({ username: "Tuntematon käyttäjä", gender: "male" });
      }
    };

    fetchUser();
  }, [userIdParam]);

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
        smoke,
        drink,
        drugs,
      };
      await api.put("/users/profile", payload);
      setSuccess(true);
      setMessage("Profiilitiedot päivitetty onnistuneesti.");
    } catch (err) {
      console.error("❌ Päivitys epäonnistui", err);
      setSuccess(false);
      setMessage("Profiilitietojen päivitys epäonnistui.");
    }
  };

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
    smoke,
    drink,
    drugs,
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
    setSmoke,
    setDrink,
    setDrugs,
    handleSubmit,
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
          <p><strong>{t("lifestyle.smoke")}:</strong> {user.smoke || "-"}</p>
          <p><strong>{t("lifestyle.drink")}:</strong> {user.drink || "-"}</p>
          <p><strong>{t("lifestyle.drugs")}:</strong> {user.drugs || "-"}</p>
        </div>
      ) : (
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







