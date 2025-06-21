import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";

import DiscoverFilters from "../components/DiscoverFilters";
import ProfileCardList from "../components/discover/ProfileCardList";
import SubNav from "../components/SubNav";

const Discover = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Hakulomakkeen kenttien state-muuttujat
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

  // Alustava haku "recommended"-profiileille sivun latautuessa
  useEffect(() => {
    const loadRecommended = async () => {
      setIsLoading(true);
      try {
        const res = await api.get("/discover");
        const data = res.data.users ?? res.data;
        const list = Array.isArray(data) ? data : [];
        const normalized = list.map((u) => ({
          ...u,
          id: u._id || u.id,
        }));
        setUsers(normalized);
      } catch (err) {
        console.error("Error fetching recommended profiles:", err);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommended();
  }, []);

  // Pass/Like/Superlike -napit
  const handleAction = async (userId, actionType) => {
    try {
      await api.post(`/discover/${userId}/${actionType}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(`Error executing ${actionType} for user ${userId}:`, err);
    }
  };

  // Lomakkeen filtteroiva funktio
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
      const list = Array.isArray(data) ? data : [];
      const normalized = list.map((u) => ({
        ...u,
        id: u._id || u.id,
      }));
      setUsers(normalized);
    } catch (err) {
      console.error("Error filtering users:", err);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Kerätään filter-arvot ja setterit DiscoverFilters-komponentille
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

  return (
    <div className="w-full flex flex-col items-center bg-gray-100 min-h-screen">
      <div className="w-full bg-[#000]">
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

      <div className="w-full max-w-[1400px] flex flex-row justify-between px-4 mt-6">
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img src="/ads/left-banner-1.jpg" alt="Advertise left" className="w-full h-auto" />
            <div className="p-4 text-center">
              <a href="/advertise" className="text-sm font-medium text-[#005FFF] hover:underline">
                Lataa sovellus
              </a>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img src="/ads/left-banner-2.jpg" alt="Advertise left" className="w-full h-auto" />
            <div className="p-4 text-center">
              <a href="/register" className="text-sm font-medium text-[#FF4081] hover:underline">
                Rekisteröidy nyt
              </a>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6">
            <DiscoverFilters
              values={values}
              setters={setters}
              handleFilter={handleFilter}
              t={t}
            />
          </div>

          <div className="mt-6 w-full">
            {isLoading ? (
              <div className="mt-12 text-center text-gray-500">
                {t("discover.loading")}…
              </div>
            ) : (
              <>
                <ProfileCardList users={users} onAction={handleAction} />
                {users.length === 0 && (
                  <div className="mt-12 text-center text-gray-500">
                    🔍 {t("discover.noResults")}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img src="/ads/right-banner-1.jpg" alt="Advertise right" className="w-full h-auto" />
            <div className="p-4 text-center">
              <a href="/contact" className="text-sm font-medium text-[#FF4081] hover:underline">
                Ota yhteyttä
              </a>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <img src="/ads/right-banner-2.jpg" alt="Advertise right" className="w-full h-auto" />
            <div className="p-4 text-center">
              <a href="/promote" className="text-sm font-medium text-[#005FFF] hover:underline">
                Place your banner now!
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Discover;
