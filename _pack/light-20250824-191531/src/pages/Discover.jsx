// File: client/src/pages/Discover.jsx

// --- REPLACE START: Discover page – add discover/common/profile/lifestyle namespaces + HiddenStatusBanner render & robust hidden guard ---
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import ProfileCardList from "../components/discover/ProfileCardList";
import DiscoverFilters from "../components/DiscoverFilters";
import SkeletonCard from "../components/SkeletonCard"; // skeleton placeholder
import HiddenStatusBanner from "../components/HiddenStatusBanner"; // <-- UI banner (shows "You are currently hidden..." + Unhide)
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axiosInstance";
import { BACKEND_BASE_URL } from "../utils/config";

// Bunny placeholder user for empty/error states only
const bunnyUser = {
  id: "bunny",
  _id: "bunny",
  username: "bunny",
  age: 25,
  gender: "female",
  orientation: "straight",
  photos: [
    { url: "/assets/bunny1.jpg" },
    { url: "/assets/bunny2.jpg" },
    { url: "/assets/bunny3.jpg" },
  ],
  location: "Unknown",
  summary: "Hi, I'm Bunny! 🐰",
};

/**
 * Helper: absolutize an image URL or /uploads path using BACKEND_BASE_URL.
 * Accepts: absolute http(s) URL, /uploads/xxx, "uploads/xxx", or bare filename.
 * Also normalizes Windows slashes and removes accidental "/uploads/uploads" duplication.
 */
function absolutizeImage(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;

  let s = pathOrUrl.trim();
  if (s === "") return null;

  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;

  // Normalize backslashes and odd prefixes
  s = s.replace(/\\/g, "/").replace(/^\.\//, "");
  // Collapse multiple slashes
  s = s.replace(/\/+/g, "/");

  // Ensure single /uploads prefix (handles "uploads/...", "/uploads/...", "/uploads/uploads/...")
  if (s.startsWith("/uploads/")) {
    s = s.replace(/^\/uploads\/uploads\//, "/uploads/");
  } else if (s.startsWith("uploads/")) {
    s = "/" + s;
  } else if (!s.startsWith("/")) {
    s = "/uploads/" + s;
  }

  return `${BACKEND_BASE_URL}${s}`;
}

const Discover = () => {
  // ✅ Load all namespaces used in this page & its child form components
  const { t } = useTranslation(["discover", "common", "profile", "lifestyle"]);

  // IMPORTANT: wait until Auth has refreshed token & /auth/me has resolved
  const { user: authUser, bootstrapped } = useAuth();

  // Main state
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterKey, setFilterKey] = useState("initial");

  // Filter form fields state
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
  const [summaryField, setSummaryField] = useState("");
  const [goals, setGoals] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [smoke, setSmoke] = useState("");
  const [drink, setDrink] = useState("");
  const [drugs, setDrugs] = useState("");
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(120);

  // Robust hidden guard – supports multiple shapes from backend
  const isHidden =
    authUser?.hidden === true ||
    authUser?.isHidden === true ||
    authUser?.visibility?.hidden === true ||
    authUser?.visibility?.isHidden === true ||
    (authUser?.visibility?.hiddenUntil &&
      new Date(authUser.visibility.hiddenUntil) > new Date()) ||
    authUser?.visibility?.status === "hidden";

  // On mount & when authUser/bootstrapped changes, load initial list
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (bootstrapped) {
      // In dev, includeSelf only when NOT hidden
      const initialParams = {
        ...(import.meta.env.DEV && !isHidden ? { includeSelf: 1 } : {}),
      };
      loadUsers(initialParams);
    }
  }, [
    authUser?.hidden,
    authUser?.isHidden,
    authUser?.visibility?.hidden,
    authUser?.visibility?.isHidden,
    authUser?.visibility?.hiddenUntil,
    authUser?.visibility?.status,
    bootstrapped,
    isHidden,
  ]);

  /**
   * Data load via GET /discover?...
   */
  const loadUsers = async (params = {}) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.get("/discover", { params });
      const data = res?.data?.users ?? res?.data ?? [];

      const normalized = Array.isArray(data)
        ? data.map((u) => {
            const photos =
              Array.isArray(u.photos) && u.photos.length
                ? u.photos.map((p) => {
                    const raw = typeof p === "string" ? p : p?.url;
                    return { url: absolutizeImage(raw) };
                  })
                : [];
            const profilePicture =
              absolutizeImage(u.profilePicture) || photos?.[0]?.url || null;
            return {
              ...u,
              id: u._id || u.id,
              profilePicture,
              photos,
            };
          })
        : [];

      if (normalized.length === 0) {
        setUsers([bunnyUser]);
      } else {
        setUsers(normalized);
      }

      setFilterKey(Date.now().toString());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading users:", err);
      setError(t("discover:error"));
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle swipe actions
   */
  const handleAction = (userId, actionType) => {
    const currentScroll = window.scrollY;
    setUsers((prev) => prev.filter((u) => (u.id || u._id) !== userId));
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

  /**
   * Handle filter submit
   */
  const handleFilter = (formValues) => {
    // In dev, includeSelf only when NOT hidden
    const query = {
      ...formValues,
      country: formValues.customCountry || formValues.country,
      region: formValues.customRegion || formValues.region,
      city: formValues.customCity || formValues.city,
      ...(import.meta.env.DEV && !isHidden ? { includeSelf: 1 } : {}),
    };

    Object.keys(query).forEach((k) => {
      if (query[k] === "" || query[k] == null) delete query[k];
    });

    const parsedMin = Number(formValues.minAge);
    const parsedMax = Number(formValues.maxAge);
    const minIsValid = Number.isFinite(parsedMin);
    const maxIsValid = Number.isFinite(parsedMax);

    if (minIsValid || maxIsValid) {
      const effMin = minIsValid ? parsedMin : 18;
      const effMax = maxIsValid ? parsedMax : 120;
      if (effMin !== 18 || effMax !== 120) {
        query.minAge = effMin;
        query.maxAge = effMax;
      } else {
        delete query.minAge;
        delete query.maxAge;
      }
    } else {
      delete query.minAge;
      delete query.maxAge;
    }

    loadUsers(query);
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
    summary: summaryField,
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
    setSummaryField,
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
          {/* Shows an informative banner if you are hidden; includes Unhide action */}
          <HiddenStatusBanner />

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
                    <SkeletonCard key={i} width="w-full" height="h-60" lines={4} />
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
                      🔍 {t("discover:noResults")}
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
// --- REPLACE END ---


















