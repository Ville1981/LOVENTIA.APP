// src/pages/Discover.jsx

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";

import DiscoverFilters from "../components/DiscoverFilters";
import ProfileCardList from "../components/discover/ProfileCardList";
import SubNav from "../components/SubNav";

const bunnyUser = {
  id: "bunny",
  _id: "bunny",
  username: "bunny",
  age: 25,
  gender: "Female",
  orientation: "Straight",
  photos: [
    { url: "/assets/bunny1.jpg" },
    { url: "/assets/bunny2.jpg" },
    { url: "/assets/bunny3.jpg" },
  ],
  location: "Unknown",
  summary: "Hi, I'm Bunny! 🐰",
};

const Discover = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterKey, setFilterKey] = useState("initial");

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

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
  const [goals, setGoals] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(99);

  useEffect(() => {
    const loadRecommended = async () => {
      setIsLoading(true);
      try {
        const res = await api.get("/discover");
        const data = res.data.users ?? res.data;
        const normalized = (Array.isArray(data) ? data : []).map((u) => ({
          ...u,
          id: u._id || u.id,
        }));
        setUsers([...normalized, bunnyUser]);
        setFilterKey(Date.now().toString());
      } catch (err) {
        console.error("Error fetching recommended profiles:", err);
        setUsers([bunnyUser]);
        setFilterKey(Date.now().toString());
      } finally {
        setIsLoading(false);
      }
    };
    loadRecommended();
  }, []);

  const handleAction = (userId, actionType) => {
    const currentScroll = window.scrollY;
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.scrollTo({ top: currentScroll, behavior: "auto" });
      }, 0);
    });

    if (userId !== bunnyUser.id) {
      api
        .post(`/discover/${userId}/${actionType}`)
        .catch((err) => console.error(`Error executing ${actionType}:`, err));
    }
  };

  const handleFilter = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const query = {
        username,
        gender,
        orientation,
        religion,
        religionImportance,
        education,
        profession,
        country: customCountry || country,
        region: customRegion || region,
        city: customCity || city,
        children,
        pets,
        summary,
        goals,
        lookingFor,
        minAge: Number(minAge),
        maxAge: Number(maxAge),
      };

      Object.keys(query).forEach((key) => {
        if (query[key] === "" || query[key] == null) delete query[key];
      });

      const res = await api.get("/discover", { params: query });
      const data = res.data.users ?? res.data;
      const normalized = (Array.isArray(data) ? data : []).map((u) => ({
        ...u,
        id: u._id || u.id,
      }));
      setUsers([...normalized, bunnyUser]);
      setFilterKey(Date.now().toString());
    } catch (err) {
      console.error("Error filtering users:", err);
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };

  const values = {
    username,
    age,
    gender,
    orientation,
    religion,
    religionImportance,
    education,
    profession,
    country,
    region,
    city,
    customCountry,
    customRegion,
    customCity,
    children,
    pets,
    summary,
    goals,
    lookingFor,
    minAge,
    maxAge,
  };

  const setters = {
    setUsername,
    setAge,
    setGender,
    setOrientation,
    setReligion,
    setReligionImportance,
    setEducation,
    setProfession,
    setCountry,
    setRegion,
    setCity,
    setCustomCountry,
    setCustomRegion,
    setCustomCity,
    setChildren,
    setPets,
    setSummary,
    setGoals,
    setLookingFor,
    setMinAge,
    setMaxAge,
  };

  return (
    <div className="w-full flex flex-col items-center bg-gray-100 min-h-screen" style={{ overflowAnchor: 'none' }}>
      <div className="w-full bg-black">
        <SubNav
          tabs={[
            { key: "recommended", label: t("subnav.recommended"), icon: "/icons/recommended.svg" },
            { key: "superlikes", label: t("subnav.superlikes"), icon: "/icons/superlikes.svg" },
            { key: "cupids-picks", label: t("subnav.cupidsPicks"), icon: "/icons/cupids-picks.svg" },
            { key: "match-percentage", label: t("subnav.matchPercentage"), icon: "/icons/match-percentage.svg" },
            { key: "passport", label: t("subnav.passport"), icon: "/icons/passport.svg" },
          ]}
          activeKey="recommended"
        />
      </div>

      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row justify-between px-4 mt-6">
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />
        <main className="flex-1">
          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto">
            <DiscoverFilters
              values={values}
              setters={setters}
              handleFilter={handleFilter}
              t={t}
            />
          </div>
          <div className="mt-6 flex justify-center w-full">
            <div className="w-full max-w-3xl">
              {isLoading ? (
                <div className="mt-12 text-center text-gray-500">{t("discover.loading")}…</div>
              ) : (
                <>
                  <ProfileCardList key={filterKey} users={users} onAction={handleAction} />
                  {users.length === 0 && (
                    <div className="mt-12 text-center text-gray-500">🔍 {t("discover.noResults")}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />
      </div>
    </div>
  );
};

export default Discover;
