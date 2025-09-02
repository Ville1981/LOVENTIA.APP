// File: client/src/pages/Discover.jsx

// --- REPLACE START: Discover page – free users can browse; gate only paid actions; premium always unlocked even if features missing ---
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import ProfileCardList from "../components/discover/ProfileCardList";
import DiscoverFilters from "../components/DiscoverFilters";
import SkeletonCard from "../components/SkeletonCard";
import HiddenStatusBanner from "../components/HiddenStatusBanner";
import PremiumGate from "../components/PremiumGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";
import { BACKEND_BASE_URL } from "../config";
import { getDealbreakers, updateDealbreakers } from "../api/dealbreakers";

// Bunny placeholder for empty/error states
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

function absolutizeImage(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  let s = pathOrUrl.trim();
  if (s === "") return null;
  if (/^https?:\/\//i.test(s)) return s;
  // Normalize slashes and leading dot segments
  s = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
  // Common server upload roots
  if (s.startsWith("/uploads/")) s = s.replace(/^\/uploads\/uploads\//, "/uploads/");
  else if (s.startsWith("uploads/")) s = "/" + s;
  else if (!s.startsWith("/")) s = "/uploads/" + s;
  return `${BACKEND_BASE_URL}${s}`;
}

const Discover = () => {
  const { t } = useTranslation(["discover", "common", "profile", "lifestyle"]);
  const { user: authUser, bootstrapped } = useAuth();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterKey, setFilterKey] = useState("initial");

  // local filter states (unchanged)
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

  // 🔓 Premium detection (tier OR legacy flags)
  const isPremium = useMemo(() => {
    return (
      authUser?.entitlements?.tier === "premium" ||
      authUser?.isPremium === true ||
      authUser?.premium === true
    );
  }, [authUser]);

  // Upsell modal state (shown when free user tries paid action)
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history)
      window.history.scrollRestoration = "manual";
    if (!bootstrapped) return;

    const isHidden =
      authUser?.hidden === true ||
      authUser?.isHidden === true ||
      authUser?.visibility?.isHidden === true ||
      (authUser?.visibility?.hiddenUntil &&
        new Date(authUser.visibility.hiddenUntil) > new Date());

    const initialParams = {
      ...(import.meta.env.DEV && !isHidden ? { includeSelf: 1 } : {}),
    };
    loadUsers(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authUser?.hidden,
    authUser?.isHidden,
    authUser?.visibility?.isHidden,
    authUser?.visibility?.hiddenUntil,
    bootstrapped,
  ]);

  // Seed min/max age from dealbreakers (if available)
  useEffect(() => {
    let mounted = true;
    const seedFromDealbreakers = async () => {
      try {
        if (!bootstrapped) return;
        const db = await getDealbreakers();
        if (!mounted || !db) return;
        if (typeof db.ageMin === "number" && Number.isFinite(db.ageMin))
          setMinAge(db.ageMin);
        if (typeof db.ageMax === "number" && Number.isFinite(db.ageMax))
          setMaxAge(db.ageMax);
      } catch {
        /* silent */
      }
    };
    seedFromDealbreakers();
    return () => {
      mounted = false;
    };
  }, [bootstrapped]);

  const loadUsers = async (params = {}) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.get("/discover", { params });
      const data = res?.data?.users ?? res?.data ?? [];
      const normalized = Array.isArray(data)
        ? data.map((u) => {
            const photos = Array.isArray(u.photos)
              ? u.photos.map((p) => {
                  const raw = typeof p === "string" ? p : p?.url;
                  return { url: absolutizeImage(raw) };
                })
              : [];
            const profilePicture =
              absolutizeImage(u.profilePicture) || photos?.[0]?.url || null;
            return { ...u, id: u._id || u.id, profilePicture, photos };
          })
        : [];
      setUsers(normalized.length ? normalized : [bunnyUser]);
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

  const handleAction = (userId, actionType) => {
    // 🚧 Free users: allow only "pass". Like/Superlike triggers upsell.
    if (!isPremium && actionType !== "pass") {
      setShowUpsell(true);
      return;
    }
    const currentScroll = window.scrollY;
    setUsers((prev) => prev.filter((u) => (u.id || u._id) !== userId));
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.scrollTo({ top: currentScroll, behavior: "auto" });
      }, 0);
    });
    if (userId !== bunnyUser.id) {
      api.post(`/discover/${userId}/${actionType}`).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`Error executing ${actionType}:`, err);
      });
    }
  };

  const handleFilter = async (formValues) => {
    const isHidden =
      authUser?.hidden === true ||
      authUser?.isHidden === true ||
      authUser?.visibility?.isHidden === true ||
      (authUser?.visibility?.hiddenUntil &&
        new Date(authUser.visibility.hiddenUntil) > new Date());

    const query = {
      ...formValues,
      country: formValues.customCountry || formValues.country,
      region: formValues.customRegion || formValues.region,
      city: formValues.customCity || formValues.city,
      ...(import.meta.env.DEV && !isHidden ? { includeSelf: 1 } : {}),
    };

    // Mirror age fields to dealbreakers (non-fatal)
    try {
      const patch = {};
      const parsedMin = Number(formValues.minAge);
      const parsedMax = Number(formValues.maxAge);
      if (Number.isFinite(parsedMin)) patch.ageMin = parsedMin;
      if (Number.isFinite(parsedMax)) patch.ageMax = parsedMax;
      if (Object.keys(patch).length > 0) await updateDealbreakers(patch);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("updateDealbreakers failed (non-fatal):", e?.message || e);
    }

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

  const handleUnhiddenRefresh = () => {
    const params = { ...(import.meta.env.DEV ? { includeSelf: 1 } : {}) };
    loadUsers(params);
  };

  return (
    <div
      className="w-full flex flex-col items-center bg-gray-100 min-h-screen"
      style={{ overflowAnchor: "none" }}
    >
      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row justify-between px-4 mt-6">
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />

        <main className="flex-1">
          {/* 🔔 Hidden account banner (visible only when hidden) */}
          <HiddenStatusBanner user={authUser} onUnhidden={handleUnhiddenRefresh} />

          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto mt-4">
            <DiscoverFilters values={values} handleFilter={handleFilter} />
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
                  {/* ✅ Free users can browse; Like/Superlike blocked in handleAction when not premium */}
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

      {/* Upsell appears only when a free user tries a paid action */}
      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-xl">
            <PremiumGate
              mode="block"
              requireFeature="unlimitedLikes"
              onUpgraded={() => setShowUpsell(false)}
            />
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setShowUpsell(false)}
                className="px-4 py-2 rounded-md bg-white border text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discover;
// --- REPLACE END ---
