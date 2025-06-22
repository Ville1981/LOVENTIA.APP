import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";

import DiscoverFilters from "../components/DiscoverFilters";
import ProfileCardList from "../components/discover/ProfileCardList";
import SubNav from "../components/SubNav";

// Bunny-fallback profiili kun back-endillä ei ole kuvia
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

  // --- suodatuslomakkeen tilat (vakio) ---
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

  // --- haetaan discover-listaus back-endistä ---
  useEffect(() => {
    const loadRecommended = async () => {
      setIsLoading(true);
      try {
        // Tänne menee /api/discover proxyn kautta
        const res = await api.get("/discover");
        // jos res.data.users on olemassa (muuten suoraan res.data)
        const data = res.data.users ?? res.data;
        // normalisoi id
        const normalized = (Array.isArray(data) ? data : []).map((u) => ({
          ...u,
          id: u._id || u.id,
        }));
        setUsers([...normalized, bunnyUser]);
      } catch (err) {
        console.error("Error fetching recommended profiles:", err);
        setUsers([bunnyUser]);
      } finally {
        setIsLoading(false);
      }
    };
    loadRecommended();
  }, []);

  // --- pass/like/superlike -toiminnot ---
  const handleAction = (userId, actionType) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (userId === bunnyUser.id) return;
    api.post(`/discover/${userId}/${actionType}`).catch((err) =>
      console.error(`Error executing ${actionType} for user ${userId}:`, err)
    );
  };

  // --- lomakesuodatin lähetys ---
  const handleFilter = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.get("/discover", {
        params: {
          username,
          age,
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
        },
      });
      const data = res.data.users ?? res.data;
      const normalized = (Array.isArray(data) ? data : []).map((u) => ({
        ...u,
        id: u._id || u.id,
      }));
      setUsers([...normalized, bunnyUser]);
    } catch (err) {
      console.error("Error filtering users:", err);
      setUsers([bunnyUser]);
    } finally {
      setIsLoading(false);
    }
  };

  // props DiscoverFiltersille
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
  };

  // kaikki profiilit näkyviin
  const displayUsers = users;

  return (
    <div className="w-full flex flex-col items-center bg-gray-100 min-h-screen">
      {/* ylänavigaatio */}
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

      {/* pääsisältö */}
      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row justify-between px-4 mt-6">
        {/* vasen sidebar (piilossa mobiilissa) */}
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          {/* ... */}
        </aside>

        {/* keskeinen sisältö */}
        <main className="flex-1">
          {/* --- suodatinlomake keskitettynä --- */}
          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto">
            <DiscoverFilters
              values={values}
              setters={setters}
              handleFilter={handleFilter}
              t={t}
            />
          </div>

          {/* --- profiilikaruselli keskitettynä --- */}
          <div className="mt-6 flex justify-center w-full">
            <div className="w-full max-w-3xl">
              {isLoading ? (
                <div className="mt-12 text-center text-gray-500">
                  {t("discover.loading")}…
                </div>
              ) : (
                <>
                  <ProfileCardList
                    key={displayUsers.map((u) => u.id).join("|")}
                    users={displayUsers}
                    onAction={handleAction}
                  />
                  {displayUsers.length === 0 && (
                    <div className="mt-12 text-center text-gray-500">
                      🔍 {t("discover.noResults")}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        {/* oikea sidebar (piilossa mobiilissa) */}
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          {/* ... */}
        </aside>
      </div>
    </div>
  );
};

export default Discover;
