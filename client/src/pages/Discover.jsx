// PATH: client/src/pages/Discover.jsx

// --- REPLACE START: add rewindBuffer + 'rewind:done' listener + like→buffer; keep rest intact ---
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDealbreakers, updateDealbreakers } from "../api/dealbreakers";
import AdBanner from "../components/AdBanner";
import AdGate from "../components/AdGate";
import ProfileCardList from "../components/discover/ProfileCardList";
import DiscoverFilters from "../components/DiscoverFilters";
import FeatureGate from "../components/FeatureGate";
import HiddenStatusBanner from "../components/HiddenStatusBanner";
import PremiumGate from "../components/PremiumGate";
import SkeletonCard from "../components/SkeletonCard";
import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";

// Bunny placeholder for empty/error states (card only, never avatar fallback)
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
  summary: "Hi, I'm Bunny!",
};

function absolutizeImage(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  let s = pathOrUrl.trim();
  if (s === "") return null;
  if (/^https?:\/\//i.test(s)) return s;
  // Normalize slashes and leading dot segments
  s = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
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

  // local filter states
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

  // Premium detection (kept for future UI toggles; underscore silences no-unused-vars)
  const _isPremium = useMemo(() => {
    return (
      authUser?.entitlements?.tier === "premium" ||
      authUser?.isPremium === true ||
      authUser?.premium === true
    );
  }, [authUser]);

  const [showUpsell, setShowUpsell] = useState(false);

  // --- Focus pause + cleanup ---
  const [selectHasFocus, setSelectHasFocus] = useState(false);
  const blurTimerRef = useRef(null);

  const onAnySelectFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setSelectHasFocus(true);
  }, []);

  const onAnySelectBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      const el = typeof document !== "undefined" ? document.activeElement : null;
      setSelectHasFocus(Boolean(el && el.tagName === "SELECT"));
      blurTimerRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function onFocusIn(e) {
      if (e?.target?.tagName === "SELECT") onAnySelectFocus();
    }
    function onFocusOut(e) {
      if (e?.target?.tagName === "SELECT") onAnySelectBlur();
    }
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [onAnySelectFocus, onAnySelectBlur]);

  const probeFocusProps = { onFocus: onAnySelectFocus, onBlur: onAnySelectBlur };

  // pending queries
  const pendingQueryRef = useRef(null);
  const flushPendingAfterBlur = useCallback(() => {
    if (!selectHasFocus && pendingQueryRef.current) {
      const params = pendingQueryRef.current;
      pendingQueryRef.current = null;
      loadUsers(params);
    }
  }, [selectHasFocus]);

  useEffect(() => {
    flushPendingAfterBlur();
  }, [selectHasFocus, flushPendingAfterBlur]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (!bootstrapped) return;
    const initialParams = { includeSelf: 1 };
    if (selectHasFocus) {
      pendingQueryRef.current = initialParams;
    } else {
      loadUsers(initialParams);
    }
  }, [bootstrapped, selectHasFocus]);

  useEffect(() => {
    let mounted = true;
    const seedFromDealbreakers = async () => {
      try {
        if (!bootstrapped || selectHasFocus) return;
        const db = await getDealbreakers();
        if (!mounted || !db) return;
        if (typeof db.ageMin === "number" && Number.isFinite(db.ageMin)) setMinAge(db.ageMin);
        if (typeof db.ageMax === "number" && Number.isFinite(db.ageMax)) setMaxAge(db.ageMax);
      } catch {
        /* silent */
      }
    };
    seedFromDealbreakers();
    return () => {
      mounted = false;
    };
  }, [bootstrapped, selectHasFocus]);

  const loadUsers = async (params = {}) => {
    if (selectHasFocus) {
      pendingQueryRef.current = params;
      return;
    }
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

      const selfId =
        authUser?._id?.toString?.() || authUser?.id?.toString?.() || null;
      const selfUser = selfId
        ? normalized.find((u) => (u.id || u._id)?.toString() === selfId)
        : null;
      const others = selfId
        ? normalized.filter((u) => (u.id || u._id)?.toString() !== selfId)
        : normalized;

      const ordered = [];
      if (selfUser) ordered.push(selfUser);
      ordered.push(bunnyUser);
      ordered.push(...others);

      setUsers(ordered.length ? ordered : [bunnyUser]);
      setFilterKey(Date.now().toString());
    } catch (err) {
      console.error("Error loading users:", err);
      setError(t("discover:error"));
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };

  const scrollTimerRef = useRef(null);

  /**
   * Keep scroll position stable while removing or restoring a card.
   */
  const preserveScrollAfter = useCallback(() => {
    const currentScroll = window.scrollY;
    requestAnimationFrame(() => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        window.scrollTo({ top: currentScroll, behavior: "auto" });
        scrollTimerRef.current = null;
      }, 0);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // REWIND BUFFER (A-option): capture liked cards locally and restore on 'rewind:done'
  // ---------------------------------------------------------------------------
  const [rewindBuffer, setRewindBuffer] = useState([]);

  const pushToRewindBuffer = useCallback((card) => {
    if (!card) return;
    const cardId = (card.id || card._id || "").toString();
    if (!cardId) return;
    setRewindBuffer((prev) => {
      if (prev.some((c) => (c.id || c._id || "").toString() === cardId)) return prev;
      const next = [...prev, card];
      // keep a sane cap; mirrors backend default max=50
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  }, []);

  useEffect(() => {
    // Listen for a CustomEvent fired by RewindButton after successful API rewind.
    // Expect: event.detail = { targetUserId: string } (may also include targetId)
    function onRewindDone(ev) {
      try {
        const targetId =
          ev?.detail?.targetUserId ||
          ev?.detail?.targetId ||
          (typeof ev?.detail === "string" ? ev.detail : null);
        if (!targetId) return;

        // If card already exists in deck, do nothing
        setUsers((prev) => {
          const exists = prev.some((u) => (u.id || u._id)?.toString() === String(targetId));
          if (exists) return prev;

          // remove from buffer and capture for insertion
          let restored = null;
          setRewindBuffer((bufPrev) => {
            const idx = bufPrev.findIndex(
              (u) => (u.id || u._id)?.toString() === String(targetId)
            );
            if (idx >= 0) {
              restored = bufPrev[idx];
              const clone = bufPrev.slice();
              clone.splice(idx, 1);
              return clone;
            }
            return bufPrev;
          });

          if (restored) {
            // Insert at deck front so it appears as the next card.
            const next = [restored, ...prev];
            preserveScrollAfter();
            return next;
          }
          return prev;
        });
      } catch (e) {
        // never throw in event handlers
        console.warn("[Discover] rewind:done handler failed:", e);
      }
    }

    window.addEventListener("rewind:done", onRewindDone);
    return () => {
      window.removeEventListener("rewind:done", onRewindDone);
    };
  }, [preserveScrollAfter]);

  // ---------------------------------------------------------------------------
  // Like/Pass/Superlike handlers
  // NOTE ABOUT LINE COUNT (padding comments, no runtime effect):
  // We keep a few explanatory comments here to maintain near-parity with the
  // previous file length for easier future diffing. Functional changes are minimal.
  // ---------------------------------------------------------------------------

  // --- Like behavior – always use /likes so rewind has history + push card into local buffer ---
  const handleAction = async (userId, actionType) => {
    const currentUserId =
      authUser?._id?.toString?.() || authUser?.id?.toString?.() || null;
    const isBunny = userId === bunnyUser.id;
    const isSelf = currentUserId && userId === currentUserId;

    setError("");

    // Remove a given card id from UI list, preserving scroll
    const removeCard = () => {
      setUsers((prev) => prev.filter((u) => (u.id || u._id) !== userId));
      preserveScrollAfter();
    };

    if (actionType === "pass") {
      // PASS: unchanged server logic; we do not buffer passes (backend rewind focuses on likes)
      removeCard();
      if (!isBunny && !isSelf) {
        api.post(`/discover/${userId}/pass`).catch((err) => {
          console.error("Error executing pass:", err);
        });
      } else {
        console.warn(`[Discover] Skipping API call for ${isBunny ? "bunny" : "self"} pass`);
      }
      return;
    }

    if (actionType === "like") {
      if (isBunny || isSelf) {
        console.warn(`[Discover] Skipping API call for ${isBunny ? "bunny" : "self"} like`);
        removeCard();
        return;
      }

      // Capture a snapshot of the card before removal (so we can restore on rewind)
      const snapshot = users.find((u) => (u.id || u._id) === userId);
      if (snapshot) pushToRewindBuffer(snapshot);

      try {
        const res = await api.post("/likes", { targetUserId: userId });
        const status = Number(res?.status) || 0;

        // Accept success (200/201) and idempotent "already liked" (409),
        // also accept truthy default (ok !== false).
        if (status === 200 || status === 201 || status === 409 || res?.data?.ok !== false) {
          removeCard();
          return;
        }

        setError("Failed to like this profile. Please try again.");
      } catch (err) {
        const status = err?.response?.status;
        const codeVal = err?.response?.data?.code;

        if (status === 429 || codeVal === "LIKE_QUOTA_EXCEEDED") {
          // Show upgrade prompt for free like quota exceeded
          setShowUpsell(true);
          return;
        }
        console.error("Like failed:", err);
        setError("Failed to like this profile. Please try again.");
      }
      return;
    }

    if (actionType === "superlike") {
      removeCard();
      if (!isBunny && !isSelf) {
        api.post(`/discover/${userId}/superlike`).catch((err) => {
          console.error("Error executing superlike:", err);
        });
      } else {
        console.warn(`[Discover] Skipping API call for ${isBunny ? "bunny" : "self"} superlike`);
      }
      return;
    }

    console.warn(`[Discover] Unknown actionType "${actionType}"`);
  };
  // --- end handlers ---

  const handleFilter = async (formValues) => {
    const query = {
      ...formValues,
      country: formValues.customCountry || formValues.country,
      region: formValues.customRegion || formValues.region,
      city: formValues.customCity || formValues.city,
      includeSelf: 1,
    };

    try {
      const patch = {};
      const parsedMin = Number(formValues.minAge);
      const parsedMax = Number(formValues.maxAge);
      if (Number.isFinite(parsedMin)) patch.ageMin = parsedMin;
      if (Number.isFinite(parsedMax)) patch.ageMax = parsedMax;
      if (Object.keys(patch).length > 0) await updateDealbreakers(patch);
    } catch (e) {
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

    if (selectHasFocus) {
      pendingQueryRef.current = query;
      return;
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
    const params = { includeSelf: 1 };
    if (selectHasFocus) {
      pendingQueryRef.current = params;
      return;
    }
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
          <HiddenStatusBanner user={authUser} onUnhidden={handleUnhiddenRefresh} />

          {/* Filters card */}
          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto mt-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FeatureGate
                feature="seeLikedYou"
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="eyes">👀</span>
                    <span>See who liked you</span>
                    <span className="ml-1 text-[10px] text-amber-700">Premium</span>
                  </span>
                }
              >
                <a
                  href="/who-liked-me"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-600 text-white"
                  title="Open 'Who liked me'"
                >
                  <span role="img" aria-label="eyes">👀</span>
                  <span>Who liked you</span>
                </a>
              </FeatureGate>

              <FeatureGate
                feature="noAds"
                invert={false}
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="ad">🪧</span>
                    <span>Ads</span>
                    <span className="ml-1 text-[10px] text-amber-700">Premium removes</span>
                  </span>
                }
              >
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-600 text-white">
                  <span role="img" aria-label="no-ads">🚫</span>
                  <span>No ads</span>
                </span>
              </FeatureGate>

              <FeatureGate
                feature="dealbreakers"
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="filter">🧩</span>
                    <span>Dealbreakers</span>
                    <span className="ml-1 text-[10px] text-amber-700">Premium</span>
                  </span>
                }
              >
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-pink-600 text-white">
                  <span role="img" aria-label="filter">🧩</span>
                  <span>Dealbreakers</span>
                </span>
              </FeatureGate>
            </div>

            <DiscoverFilters
              values={values}
              handleFilter={handleFilter}
              setters={setters}
              probeFocusProps={probeFocusProps}
            />
          </div>

          {/* Ad slot (hidden for Premium/no-ads via AdGate) */}
          <div className="max-w-3xl mx-auto w-full">
            <AdGate type="inline">
              <AdBanner
                imageSrc="/ads/ad-right1.png"
                headline="Sponsored"
                body="Upgrade to Premium to remove all ads."
              />
            </AdGate>
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

