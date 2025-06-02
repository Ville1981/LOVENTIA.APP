// src/pages/Discover.jsx

import React, { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import DiscoverFilters from "../components/DiscoverFilters";
import UserCardList from "../components/UserCard";

const Discover = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);

  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [orientation, setOrientation] = useState("");
  const [religion, setReligion] = useState("");
  const [religionImportance, setReligionImportance] = useState("");
  const [education, setEducation] = useState("");
  const [profession, setProfession] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [children, setChildren] = useState("");
  const [pets, setPets] = useState("");
  const [summary, setSummary] = useState("");
  const [goal, setGoal] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  const handleFilter = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.get("/api/users", {
        params: {
          username, age, gender, orientation,
          religion, religionImportance,
          education, profession,
          country, region, city,
          children, pets, summary, goal, lookingFor,
        },
      });
      setUsers(res.data);
    } catch (error) {
      console.error("Error filtering users:", error);
    }
  };

  const values = {
    username, age, gender, orientation,
    religion, religionImportance,
    education, profession,
    country, region, city,
    customCountry, customRegion, customCity,
    children, pets, summary, goal, lookingFor,
  };

  const setters = {
    setUsername, setAge, setGender, setOrientation,
    setReligion, setReligionImportance,
    setEducation, setProfession,
    setCountry, setRegion, setCity,
    setCustomCountry, setCustomRegion, setCustomCity,
    setChildren, setPets, setSummary, setGoal, setLookingFor,
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="form-container mt-6">
        <DiscoverFilters
          values={values}
          setters={setters}
          handleFilter={handleFilter}
          t={t}
        />
      </div>
      <div className="mt-6 w-full max-w-[1400px] px-4">
        <UserCardList users={users} />
      </div>
    </div>
  );
};

export default Discover;
