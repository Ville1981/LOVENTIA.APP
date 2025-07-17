// src/pages/Discover.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";
import { useAuth } from "../context/AuthContext";
import DiscoverFilters from "../components/DiscoverFilters";
import ProfileCardList from "../components/discover/ProfileCardList";
import SkeletonCard from "../components/SkeletonCard"; // skeleton placeholder

// Bunny placeholder user for initial view or on error
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
  const { user: authUser } = useAuth();

  // Main state
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterKey, setFilterKey] = useState("initial");

  // Filter form fields state (maxAge default now 120)
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
  const [smoke, setSmoke] = useState("");
  const [drink, setDrink] = useState("");
  const [drugs, setDrugs] = useState("");
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(120);

  // On mount & when authUser changes, load initial list
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    loadUsers();
  }, [authUser]);

  /**
   * Initial (and filtered) data load via GET /discover?...
   */
  const loadUsers = async (params = {}) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.get("/discover", { params });
      const data = res.data.users ?? res.data;
      const normalized = Array.isArray(data)
        ? data.map((u) => ({ ...u, id: u._id || u.id }))
        : [];
      setUsers([...normalized, bunnyUser]);
      setFilterKey(Date.now().toString());
    } catch (err) {
      console.error("Error loading users:", err);
      setError(t("discover.error"));
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle swipe actions (like/dislike)
   */
  const handleAction = (userId, actionType) => {
    const currentScroll = window.scrollY;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.scrollTo({ top: currentScroll, behavior: "auto" });
      }, 0);
    });
    if (userId !== bunnyUser.id) {
      api.post(`/discover/${userId}/${actionType}`).catch((err) =>
        console.error(`Error executing ${actionType}:`, err)
      );
    }
  };

  /**
   * Filter submission: aina uudelleen GET /discover?...
   */
  const handleFilter = (formValues) => {
    // yhdistä custom-kentät ja numerot
    const query = {
      ...formValues,
      country: formValues.customCountry || formValues.country,
      region: formValues.customRegion || formValues.region,
      city: formValues.customCity || formValues.city,
      minAge: Number(formValues.minAge),
      maxAge: Number(formValues.maxAge),
    };
    // poista tyhjät
    Object.keys(query).forEach((k) => {
      if (query[k] === "" || query[k] == null) delete query[k];
    });
    loadUsers(query);
  };

  // Bundled props for DiscoverFilters
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
    smoke,
    drink,
    drugs,
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
    setSmoke,
    setDrink,
    setDrugs,
    setMinAge,
    setMaxAge,
  };

  return (
    <div
      className="w-full flex flex-col items-center bg-gray-100 min-h-screen"
      style={{ overflowAnchor: "none" }}
    >
      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row justify-between px-4 mt-6">
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />

        <main className="flex-1">
          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto">
            <DiscoverFilters
              t={t}
              values={values}
              setters={setters}
              handleFilter={handleFilter}
            />
          </div>

          <div className="mt-6 flex justify-center w-full">
            <div className="w-full max-w-3xl">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard
                      key={i}
                      width="w-full"
                      height="h-60"
                      lines={4}
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="mt-12 text-center text-red-600">{error}</div>
              ) : (
                <>
                  <ProfileCardList
                    key={filterKey}
                    users={users}
                    onAction={handleAction}
                  />
                  {users.length === 0 && (
                    <div className="mt-12 text-center text-gray-500">
                      🔍 {t("discover.noResults")}
                    </div>
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


