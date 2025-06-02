import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import "../styles/ads.css";
import ProfileForm from "../components/profileFields/ProfileForm";

const UserProfile = () => {
  const { t } = useTranslation();
  const token = localStorage.getItem("token");

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const u = res.data;
        setUser(u);
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
      } catch (err) {
        console.error("❌ Profiilin haku epäonnistui", err);
        setMessage(t("profile.fetchError"));
      }
    };

    fetchUser();
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        username, email, age, gender, orientation,
        country: country || customCountry,
        region: region || customRegion,
        city: city || customCity,
        education, profession, religion, religionImportance,
        children, pets, summary, goal, lookingFor,
      };

      await axios.put("http://localhost:5000/api/user/profile", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess(true);
      setMessage("");
    } catch (err) {
      console.error("❌ Päivitys epäonnistui", err);
      setMessage(t("profile.updateError"));
    }
  };

  const values = {
    username, email, age, gender, orientation,
    country, region, city,
    customCountry, customRegion, customCity,
    education, profession, religion, religionImportance,
    children, pets, summary, goal, lookingFor,
  };

  const setters = {
    setUsername, setEmail, setAge, setGender, setOrientation,
    setCountry, setRegion, setCity,
    setCustomCountry, setCustomRegion, setCustomCity,
    setEducation, setProfession, setReligion, setReligionImportance,
    setChildren, setPets, setSummary, setGoal, setLookingFor,
  };

  return (
    <>
      <h2 className="text-xl font-bold text-center mb-4">
        👤 {t("profile.title")}
      </h2>
      <ProfileForm
        values={values}
        setters={setters}
        t={t}
        handleSubmit={handleSubmit}
        message={message}
        success={success}
      />
    </>
  );
};

export default UserProfile;
