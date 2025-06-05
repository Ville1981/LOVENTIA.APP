// src/pages/Discover.jsx

import React, { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import DiscoverFilters from "../components/DiscoverFilters";
import UserCardList from "../components/UserCardList";
import SubNav from "../components/SubNav";

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
      // Haetaan mock-data serveristä /api/users
      const res = await axios.get("/api/users", {
        params: {
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
          children,
          pets,
          summary,
          goal,
          lookingFor,
        },
      });
      setUsers(res.data);
    } catch (error) {
      console.error("Error filtering users:", error);
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
    goal,
    lookingFor,
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
    setGoal,
    setLookingFor,
  };

  return (
    <div className="w-full flex flex-col items-center bg-gray-100 min-h-screen">
      {/* --- SubNav (OKCupid-tyyliset välilehdet) --- */}
      <div className="w-full bg-[#111]">
        <SubNav
          tabs={[
            {
              key: "recommended",
              label: t("subnav.recommended"),
              icon: "/icons/recommended.svg",
            },
            {
              key: "superlikes",
              label: t("subnav.superlikes"),
              icon: "/icons/superlikes.svg",
            },
            {
              key: "cupids-picks",
              label: t("subnav.cupidsPicks"),
              icon: "/icons/cupids-picks.svg",
            },
            {
              key: "match-percentage",
              label: t("subnav.matchPercentage"),
              icon: "/icons/match-percentage.svg",
            },
            {
              key: "passport",
              label: t("subnav.passport"),
              icon: "/icons/passport.svg",
            },
          ]}
          activeKey="recommended"
        />
      </div>

      {/* --- Kolmisarakeasettelu: Vasen | Keskiosa | Oikea --- */}
      <div className="w-full max-w-[1400px] flex flex-row justify-between px-4 mt-6">
        {/* Vasemman sarakkeen mainos (200px leveä, sticky) */}
        <div className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          {/* Mainos 1 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img
              src="/ads/left-banner-1.jpg"
              alt="Advertise left"
              className="w-full h-auto"
            />
            <div className="p-4 text-center">
              <a
                href="/advertise"
                className="text-sm font-medium text-[#005FFF] hover:underline"
              >
                Lataa sovellus
              </a>
            </div>
          </div>
          {/* Mainos 2 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img
              src="/ads/left-banner-2.jpg"
              alt="Advertise left"
              className="w-full h-auto"
            />
            <div className="p-4 text-center">
              <a
                href="/register"
                className="text-sm font-medium text-[#FF4081] hover:underline"
              >
                Rekisteröidy nyt
              </a>
            </div>
          </div>
        </div>

        {/* Keskimmäinen sarake (hakulomake + profiilit) */}
        <div className="flex-1 px-4">
          {/* Hakulomake-kortti */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6">
            <DiscoverFilters
              values={values}
              setters={setters}
              handleFilter={handleFilter}
              t={t}
            />
          </div>

          {/* Profiilikorttilista */}
          <div className="mt-6 w-full">
            <UserCardList users={users} />
            {users.length === 0 && (
              <div className="mt-12 text-center text-gray-500">
                🔍 {t("discover.noResults")}
              </div>
            )}
          </div>
        </div>

        {/* Oikean sarakkeen mainos (200px leveä, sticky) */}
        <div className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          {/* Mainos 1 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img
              src="/ads/right-banner-1.jpg"
              alt="Advertise right"
              className="w-full h-auto"
            />
            <div className="p-4 text-center">
              <a
                href="/contact"
                className="text-sm font-medium text-[#FF4081] hover:underline"
              >
                Ota yhteyttä
              </a>
            </div>
          </div>
          {/* Mainos 2 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img
              src="/ads/right-banner-2.jpg"
              alt="Advertise right"
              className="w-full h-auto"
            />
            <div className="p-4 text-center">
              <a
                href="/promote"
                className="text-sm font-medium text-[#005FFF] hover:underline"
              >
                Place your banner now!
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discover;
