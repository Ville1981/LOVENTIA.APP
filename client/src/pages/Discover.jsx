// --- REPLACE START: add rewindBuffer + 'rewind:done' listener + like→buffer + superlike quota-aware handler + likes quota state wiring + premium flag on cards ---
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getDealbreakers,
  updateDealbreakers,
  // --- REPLACE START: use shared client helper for POST /api/search with dealbreakers ---
  discoverWithDealbreakers,
  // --- REPLACE END ---
} from "../api/dealbreakers";
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

/**
 * Normalize and absolutize image URLs for Discover cards.
 *
 * The backend can return:
 *  - absolute URLs (https://…)
 *  - relative paths with or without /uploads/
 *  - Windows-style paths with backslashes
 *
 * This helper makes sure every card photo ends up as an absolute,
 * browser-safe URL that points to BACKEND_BASE_URL.
 */
function absolutizeImage(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;

  let s = pathOrUrl.trim();
  if (s === "") return null;

  // Already an absolute http/https URL → return as-is.
  if (/^https?:\/\//i.test(s)) return s;

  // Normalize slashes and leading dot segments.
  s = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");

  // Common /uploads variations from legacy code.
  if (s.startsWith("/uploads/")) {
    s = s.replace(/^\/uploads\/uploads\//, "/uploads/");
  } else if (s.startsWith("uploads/")) {
    s = "/" + s;
  } else if (!s.startsWith("/")) {
    s = "/uploads/" + s;
  }

  return `${BACKEND_BASE_URL}${s}`;
}

/**
 * Determine if a candidate user in Discover should be treated as Premium.
 * Supports multiple shapes:
 *  - user.premium === true
 *  - user.isPremium === true
 *  - user.entitlements.tier === "premium"
 *
 * We attach this as a boolean flag on each Discover user so that card
 * components can render a Premium badge without guessing field names.
 */
function isPremiumDiscoverUser(user) {
  if (!user) return false;

  if (user.premium === true || user.isPremium === true) {
    return true;
  }

  const tier = user.entitlements?.tier;
  return tier === "premium";
}

const Discover = () => {
  const { t } = useTranslation(["discover", "common", "profile", "lifestyle"]);
  const {
    user: authUser,
    bootstrapped,
    refreshMe,
    superLikesRemaining,
  } = useAuth();

  // Cards currently in the Discover deck (including bunny + possibly self).
  const [users, setUsers] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Used as React key for ProfileCardList to force remount when deck changes radically.
  const [filterKey, setFilterKey] = useState("initial");

  // (NEW) Daily likes quota (for free users UI: X/Y likes today).
  const [likesLimitPerDay, setLikesLimitPerDay] = useState(null);
  const [likesRemainingToday, setLikesRemainingToday] = useState(null);

  // Local filter states – passed down into DiscoverFilters as controlled values.
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

  // Premium detection used both for UI hints and deciding whether to send
  // dealbreakers to /api/search.
  const isPremiumForDiscover = useMemo(() => {
    return (
      authUser?.entitlements?.tier === "premium" ||
      authUser?.isPremium === true ||
      authUser?.premium === true
    );
  }, [authUser]);

  // Upsell modal for LIKE_QUOTA_EXCEEDED.
  const [showUpsell, setShowUpsell] = useState(false);

  // ---------------------------------------------------------------------------
  // Focus handling for select-elements inside filters
  // ---------------------------------------------------------------------------

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

  // Global listeners to catch focus changes on selects even inside nested components.
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

  // Props for any select element that wants local focus detection as well.
  const probeFocusProps = { onFocus: onAnySelectFocus, onBlur: onAnySelectBlur };

  // ---------------------------------------------------------------------------
  // Deferred query handling: do not refetch while user is actively editing selects
  // ---------------------------------------------------------------------------

  const pendingQueryRef = useRef(null);

  const flushPendingAfterBlur = useCallback(() => {
    if (!selectHasFocus && pendingQueryRef.current) {
      const params = pendingQueryRef.current;
      pendingQueryRef.current = null;
      // For now we only defer simple /discover loads here; Discover search via
      // /api/search is handled directly via runSearchWithDealbreakers.
      loadUsers(params);
    }
  }, [selectHasFocus]);

  useEffect(() => {
    flushPendingAfterBlur();
  }, [selectHasFocus, flushPendingAfterBlur]);

  // Initial load once auth/user context is ready.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (!bootstrapped) return;

    const initialParams = { includeSelf: 1 };

    if (selectHasFocus) {
      // Save for later if user currently focuses dropdowns.
      pendingQueryRef.current = initialParams;
    } else {
      loadUsers(initialParams);
    }
  }, [bootstrapped, selectHasFocus]);

  // Seed age range from dealbreakers so Discover and dealbreakers stay in sync.
  useEffect(() => {
    let mounted = true;

    const seedFromDealbreakers = async () => {
      try {
        if (!bootstrapped || selectHasFocus) return;
        const db = await getDealbreakers();
        if (!mounted || !db) return;

        if (typeof db.ageMin === "number" && Number.isFinite(db.ageMin)) {
          setMinAge(db.ageMin);
        }
        if (typeof db.ageMax === "number" && Number.isFinite(db.ageMax)) {
          setMaxAge(db.ageMax);
        }
      } catch {
        // Non-fatal; just keep default age range.
      }
    };

    seedFromDealbreakers();
    return () => {
      mounted = false;
    };
  }, [bootstrapped, selectHasFocus]);

  // ---------------------------------------------------------------------------
  // Fetching profiles for Discover
  // ---------------------------------------------------------------------------

  // --- REPLACE START: shared normalization helper for /discover and /api/search results ---
  const buildDiscoverDeck = useCallback(
    (rawData) => {
      const data = Array.isArray(rawData) ? rawData : [];

      const normalized = data.map((u) => {
        const photos = Array.isArray(u.photos)
          ? u.photos.map((p) => {
              const raw = typeof p === "string" ? p : p?.url;
              return { url: absolutizeImage(raw) };
            })
          : [];
        const profilePicture =
          absolutizeImage(u.profilePicture) || photos?.[0]?.url || null;

        const isPremiumUser = isPremiumDiscoverUser(u);

        return {
          ...u,
          id: u._id || u.id,
          profilePicture,
          photos,
          isPremiumUser,
        };
      });

      // Put current user first (if present), then bunny, then others.
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

      return ordered.length ? ordered : [bunnyUser];
    },
    [authUser]
  );
  // --- REPLACE END ---

  const loadUsers = async (params = {}) => {
    // If a select is focused, we postpone network calls until blur.
    if (selectHasFocus) {
      pendingQueryRef.current = params;
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.get("/discover", { params });

      /**
       * Backend response compatibility layer:
       *  - legacy:  [ ...users ]
       *  - legacy2: { users: [ ... ] }
       *  - current: { data:  [ ... ], meta: { ... } }
       */
      const payload = res?.data;
      let data = [];

      if (Array.isArray(payload)) {
        data = payload;
      } else if (Array.isArray(payload?.users)) {
        data = payload.users;
      } else if (Array.isArray(payload?.data)) {
        data = payload.data;
      } else {
        data = [];
      }

      const deck = buildDiscoverDeck(data);
      setUsers(deck);
      setFilterKey(Date.now().toString());
    } catch (err) {
      console.error("Error loading users:", err);

      // Avoid i18next object/translation errors here; always ensure a plain string.
      let fallbackMessage =
        "Failed to load profiles. Please log in again and try once more.";
      try {
        const maybe = t("discover:error");
        if (typeof maybe === "string") {
          fallbackMessage = maybe;
        } else if (maybe && typeof maybe === "object" && typeof maybe.en === "string") {
          fallbackMessage = maybe.en;
        }
      } catch {
        // ignore and keep fallbackMessage
      }

      setError(fallbackMessage);
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };

  // --- REPLACE START: dedicated helper for POST /api/search with dealbreakers support ---
  const runSearchWithDealbreakers = async (searchBody) => {
    setIsLoading(true);
    setError("");

    try {
      const resp = (await discoverWithDealbreakers(searchBody)) || {};
      const results = Array.isArray(resp.results) ? resp.results : [];

      const deck = buildDiscoverDeck(results);
      setUsers(deck);
      setFilterKey(Date.now().toString());
    } catch (err) {
      console.error("Error searching users (dealbreakers):", err);

      let fallbackMessage =
        "Failed to search profiles. Please log in again and try once more.";
      try {
        const maybe = t("discover:error");
        if (typeof maybe === "string") {
          fallbackMessage = maybe;
        } else if (maybe && typeof maybe === "object" && typeof maybe.en === "string") {
          fallbackMessage = maybe.en;
        }
      } catch {
        // ignore
      }

      setError(fallbackMessage);
      setUsers([bunnyUser]);
      setFilterKey(Date.now().toString());
    } finally {
      setIsLoading(false);
    }
  };
  // --- REPLACE END: dedicated helper for POST /api/search with dealbreakers support ---

  // ---------------------------------------------------------------------------
  // Scroll preservation around card removal / rewind
  // ---------------------------------------------------------------------------

  const scrollTimerRef = useRef(null);

  /**
   * Keep scroll position stable while removing or restoring a card.
   * This prevents "jumping" of the page when the top card disappears.
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

  // Local buffer that mirrors backend rewind stack just for UI restoration.
  const [rewindBuffer, setRewindBuffer] = useState([]);

  const pushToRewindBuffer = useCallback((card) => {
    if (!card) return;
    const cardId = (card.id || card._id || "").toString();
    if (!cardId) return;

    setRewindBuffer((prev) => {
      // Do not store duplicates.
      if (prev.some((c) => (c.id || c._id || "").toString() === cardId)) return prev;

      const next = [...prev, card];
      // Keep sane cap; mirrors backend default max=50.
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  }, []);

  useEffect(() => {
    // Listen for a CustomEvent fired by RewindButton after successful API rewind.
    // Expect: event.detail = { targetUserId: string } (may also include targetId, userId).
    function onRewindDone(ev) {
      try {
        const targetId =
          ev?.detail?.targetUserId ||
          ev?.detail?.targetId ||
          (typeof ev?.detail === "string" ? ev.detail : null);

        if (!targetId) return;

        // First update the rewind buffer: remove the matching card and, if found,
        // restore it into the front of the users deck in a separate state update.
        setRewindBuffer((bufPrev) => {
          const stringId = String(targetId);
          const idx = bufPrev.findIndex(
            (u) => (u.id || u._id)?.toString() === stringId
          );

          if (idx < 0) {
            // Nothing to restore from buffer – leave buffer as-is and deck untouched.
            return bufPrev;
          }

          const clone = bufPrev.slice();
          const [restored] = clone.splice(idx, 1);

          if (restored) {
            setUsers((prevUsers) => {
              const exists = prevUsers.some(
                (u) => (u.id || u._id)?.toString() === stringId
              );
              if (exists) return prevUsers;

              const next = [restored, ...prevUsers];
              console.log("[Discover] Rewind restored card to deck:", stringId);
              preserveScrollAfter();
              return next;
            });

            // Force ProfileCardList to remount so it definitely picks up the new deck.
            setFilterKey(Date.now().toString());
          }

          return clone;
        });
      } catch (e) {
        // Never throw from event handlers – just log a warning.
        console.warn("[Discover] rewind:done handler failed:", e);
      }
    }

    window.addEventListener("rewind:done", onRewindDone);
    return () => {
      window.removeEventListener("rewind:done", onRewindDone);
    };
  }, [preserveScrollAfter]);

  // ---------------------------------------------------------------------------
  // Like / Pass / Super Like handlers
  // ---------------------------------------------------------------------------

  /**
   * Central handler for all swipe actions:
   *  - "pass"      → /discover/:id/pass (no rewind history)
   *  - "like"      → /likes (rewind-enabled + like quota)
   *  - "superlike" → /superlike (weekly Super Like quota)
   */
  const handleAction = async (userId, actionType) => {
    const currentUserId =
      authUser?._id?.toString?.() || authUser?.id?.toString?.() || null;
    const isBunny = userId === bunnyUser.id;
    const isSelf = currentUserId && userId === currentUserId;

    setError("");

    // Remove a given card id from UI list, preserving scroll.
    const removeCard = () => {
      setUsers((prev) =>
        prev.filter((u) => (u.id || u._id)?.toString() !== String(userId))
      );
      preserveScrollAfter();
    };

    // ---------------- PASS ----------------
    if (actionType === "pass") {
      // PASS: unchanged server logic; we do not buffer passes (backend rewind focuses on likes).
      removeCard();

      if (!isBunny && !isSelf) {
        api.post(`/discover/${userId}/pass`).catch((err) => {
          console.error("Error executing pass:", err);
        });
      } else {
        console.warn(
          `[Discover] Skipping API call for ${
            isBunny ? "bunny" : "self"
          } pass`
        );
      }
      return;
    }

    // ---------------- LIKE ----------------
    if (actionType === "like") {
      if (isBunny || isSelf) {
        console.warn(
          `[Discover] Skipping API call for ${
            isBunny ? "bunny" : "self"
          } like`
        );
        removeCard();
        return;
      }

      // Capture a snapshot of the card before removal (so we can restore on rewind).
      const snapshot = users.find(
        (u) => (u.id || u._id)?.toString() === String(userId)
      );
      if (snapshot) pushToRewindBuffer(snapshot);

      try {
        const res = await api.post("/likes", { targetUserId: userId });
        const status = Number(res?.status) || 0;

        // (NEW) Extract like quota from successful response for UI ("X / Y likes today").
        // Expected shape for free users:
        //   { ok: true, newLike, remaining, limit, resetAt, timeZone }
        try {
          const payload = res?.data || {};
          const rawLimit =
            payload?.limit ?? (payload?.quota && payload.quota.limit);
          const rawRemaining =
            payload?.remaining ??
            (payload?.quota && payload.quota.remaining);

          const limitNum = Number(rawLimit);
          const remainingNum = Number(rawRemaining);

          if (Number.isFinite(limitNum) && limitNum > 0) {
            setLikesLimitPerDay(limitNum);
          } else {
            // For premium / unlimited likes, clear quota UI.
            setLikesLimitPerDay(null);
          }

          if (
            Number.isFinite(remainingNum) &&
            remainingNum >= 0 &&
            Number.isFinite(limitNum) &&
            limitNum > 0
          ) {
            setLikesRemainingToday(remainingNum);
          } else {
            setLikesRemainingToday(null);
          }
        } catch (quotaErr) {
          console.warn(
            "[Discover] Failed to parse likes quota from response:",
            quotaErr
          );
        }

        // Accept success (200/201) and idempotent "already liked" (409),
        // also accept truthy default (ok !== false).
        if (
          status === 200 ||
          status === 201 ||
          status === 409 ||
          res?.data?.ok !== false
        ) {
          removeCard();
          return;
        }

        setError("Failed to like this profile. Please try again.");
      } catch (err) {
        const status = err?.response?.status;
        const codeVal = err?.response?.data?.code;

        // (BEST EFFORT) If backend returns quota data even on error, capture it.
        try {
          const payloadErr = err?.response?.data || {};
          const rawLimitErr =
            payloadErr?.limit ??
            (payloadErr?.quota && payloadErr.quota.limit);
          const rawRemainingErr =
            payloadErr?.remaining ??
            (payloadErr?.quota && payloadErr.quota.remaining);

          const limitErrNum = Number(rawLimitErr);
          const remainingErrNum = Number(rawRemainingErr);

          if (Number.isFinite(limitErrNum) && limitErrNum > 0) {
            setLikesLimitPerDay(limitErrNum);
          }
          if (
            Number.isFinite(remainingErrNum) &&
            remainingErrNum >= 0 &&
            Number.isFinite(limitErrNum) &&
            limitErrNum > 0
          ) {
            setLikesRemainingToday(remainingErrNum);
          }
        } catch (quotaErr2) {
          console.warn(
            "[Discover] Failed to parse likes quota from error response:",
            quotaErr2
          );
        }

        if (status === 429 || codeVal === "LIKE_QUOTA_EXCEEDED") {
          // Show upgrade prompt for free like quota exceeded.
          setShowUpsell(true);
          return;
        }

        console.error("Like failed:", err);
        setError("Failed to like this profile. Please try again.");
      }
      return;
    }

    // ---------------- SUPER LIKE ----------------
    // --- REPLACE START: superlike handler uses /superlike + quota-aware error handling + refreshMe() ---
    if (actionType === "superlike") {
      if (isBunny || isSelf) {
        console.warn(
          `[Discover] Skipping API call for ${
            isBunny ? "bunny" : "self"
          } superlike`
        );
        // For bunny/self we just advance the deck locally without touching quotas.
        removeCard();
        return;
      }

      // Optional client-side guard: if AuthContext already knows there are 0 Super Likes left,
      // skip the API call and show a clear message instead of a generic error.
      if (typeof superLikesRemaining === "number" && superLikesRemaining <= 0) {
        setError(
          "You have used all your Super Likes for this week. They reset on Monday 00:00."
        );
        return;
      }

      try {
        const res = await api.post("/superlike", { targetUserId: userId });
        const status = Number(res?.status) || 0;
        const ok = res?.data?.ok;

        if (status === 200 || status === 201 || ok === true) {
          // On success we advance the deck.
          removeCard();

          // Refresh AuthContext quotas so ActionButtons label updates (X/Y).
          try {
            if (typeof refreshMe === "function") {
              // Fire-and-forget; the current view does not wait for this promise.
              void refreshMe();
            }
          } catch (refreshErr) {
            console.warn(
              "[Discover] refreshMe() after superlike failed:",
              refreshErr
            );
          }

          return;
        }

        // Unexpected non-error response (no exception thrown but also not marked ok).
        setError("Failed to Super Like this profile. Please try again.");
      } catch (err) {
        const status = err?.response?.status;
        const codeVal = err?.response?.data?.code;

        // Prefer backend-provided error text where available.
        const backendError =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "";

        const quotaMessage =
          backendError &&
          typeof backendError === "string" &&
          backendError.trim().length > 0
            ? backendError
            : "You have used all your Super Likes for this week. They reset on Monday 00:00.";

        // Backend currently returns HTTP 429 + code "SUPERLIKE_QUOTA_EXCEEDED" when quota is exhausted.
        if (
          status === 429 ||
          status === 403 ||
          codeVal === "SUPERLIKE_QUOTA_EXCEEDED"
        ) {
          // Quota reached → do NOT remove the card, only show a clear message.
          setError(quotaMessage);
          return;
        }

        console.error("Super Like failed:", err);
        setError("Failed to Super Like this profile. Please try again.");
      }
      return;
    }
    // --- REPLACE END: superlike handler uses /superlike + quota-aware error handling + refreshMe() ---

    // Fallback if an unknown actionType is passed.
    console.warn(`[Discover] Unknown actionType "${actionType}"`);
  };
  // --- end handlers ---

  // ---------------------------------------------------------------------------
  // Filter submit handler – builds query params + persists to dealbreakers
  // ---------------------------------------------------------------------------

  // --- REPLACE START: use /api/search + dealbreakers for Premium users ---
  const handleFilter = async (formValues) => {
    // Base query (kept for future /discover compatibility and dealbreakers patch seeding).
    const query = {
      ...formValues,
      country: formValues.customCountry || formValues.country,
      region: formValues.customRegion || formValues.region,
      city: formValues.customCity || formValues.city,
      includeSelf: 1,
    };

    // Persist age range to dealbreakers (so it is reused later in other parts of the app).
    try {
      const patch = {};
      const parsedMinForPatch = Number(formValues.minAge);
      const parsedMaxForPatch = Number(formValues.maxAge);

      if (Number.isFinite(parsedMinForPatch)) patch.ageMin = parsedMinForPatch;
      if (Number.isFinite(parsedMaxForPatch)) patch.ageMax = parsedMaxForPatch;

      if (Object.keys(patch).length > 0) {
        await updateDealbreakers(patch);
      }
    } catch (e) {
      console.warn("updateDealbreakers failed (non-fatal):", e?.message || e);
    }

    // Remove empty strings / nulls to keep query compact.
    Object.keys(query).forEach((k) => {
      if (query[k] === "" || query[k] == null) delete query[k];
    });

    // Normalize age range: only send minAge/maxAge when they differ from defaults.
    const parsedMin = Number(formValues.minAge);
    const parsedMax = Number(formValues.maxAge);
    const minIsValid = Number.isFinite(parsedMin);
    const maxIsValid = Number.isFinite(parsedMax);

    let effMin = 18;
    let effMax = 120;

    if (minIsValid || maxIsValid) {
      effMin = minIsValid ? parsedMin : 18;
      effMax = maxIsValid ? parsedMax : 120;

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

    // Build location object for POST /api/search.
    const location =
      query.country || query.region || query.city
        ? {
            country: query.country,
            region: query.region,
            city: query.city,
          }
        : undefined;

    // Build dealbreakers object from form values when available.
    let dealbreakersToSend = null;

    if (formValues && typeof formValues.dealbreakers === "object") {
      // If DiscoverFilters already bundles them under .dealbreakers, pass through as-is.
      dealbreakersToSend = { ...formValues.dealbreakers };
    } else {
      const db = {};

      if (formValues?.mustHavePhoto) {
        db.mustHavePhoto = true;
      }
      if (formValues?.nonSmokerOnly) {
        db.nonSmokerOnly = true;
      }
      if (formValues?.noDrugs) {
        db.noDrugs = true;
      }

      // Optionally tighten age in dealbreakers as strict bounds.
      if (minIsValid) db.ageMin = effMin;
      if (maxIsValid) db.ageMax = effMax;

      if (Object.keys(db).length > 0) {
        dealbreakersToSend = db;
      }
    }

    // Body for POST /api/search – light and explicit.
    const searchBody = {
      includeSelf: 1,
    };

    if (effMin !== 18 || effMax !== 120) {
      searchBody.minAge = effMin;
      searchBody.maxAge = effMax;
    }

    if (formValues.gender && formValues.gender !== "any") {
      searchBody.gender = formValues.gender;
    }

    if (location) {
      searchBody.location = location;
    }

    // Only Premium users actually send dealbreakers to the backend;
    // Free users still get basic search without strict filters. The server
    // will ignore dealbreakers for non-premium anyway, but skipping them
    // here keeps intent clear and avoids noisy logs.
    if (isPremiumForDiscover && dealbreakersToSend) {
      searchBody.dealbreakers = dealbreakersToSend;
    }

    return runSearchWithDealbreakers(searchBody);
  };
  // --- REPLACE END: use /api/search + dealbreakers for Premium users ---

  // Collect values and setters into simple objects for DiscoverFilters.
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

  // Callback when HiddenStatusBanner detects the profile was unhidden.
  const handleUnhiddenRefresh = () => {
    const params = { includeSelf: 1 };
    if (selectHasFocus) {
      pendingQueryRef.current = params;
      return;
    }
    loadUsers(params);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="w-full flex flex-col items-center bg-gray-100 min-h-screen"
      style={{ overflowAnchor: "none" }}
    >
      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row justify-between px-4 mt-6">
        {/* Left ad column (currently empty placeholder, ready for future ads) */}
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />

        <main className="flex-1">
          <HiddenStatusBanner user={authUser} onUnhidden={handleUnhiddenRefresh} />

          {/* Filters card */}
          <div className="bg-white border rounded-lg shadow-md p-6 max-w-3xl mx-auto mt-4">
            {/* Top row: premium feature chips */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FeatureGate
                feature="seeLikedYou"
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="eyes">
                      👀
                    </span>
                    <span>See who liked you</span>
                    <span className="ml-1 text-[10px] text-amber-700">Premium</span>
                  </span>
                }
              >
                <a
                  href="/likes"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-600 text-white"
                  title="Open 'Who liked me'"
                >
                  <span role="img" aria-label="eyes">
                    👀
                  </span>
                  <span>Who liked you</span>
                </a>
              </FeatureGate>

              <FeatureGate
                feature="noAds"
                invert={false}
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="ad">
                      🪧
                    </span>
                    <span>Ads</span>
                    <span className="ml-1 text-[10px] text-amber-700">
                      Premium removes
                    </span>
                  </span>
                }
              >
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-600 text-white">
                  <span role="img" aria-label="no-ads">
                    🚫
                  </span>
                  <span>No ads</span>
                </span>
              </FeatureGate>

              <FeatureGate
                feature="dealbreakers"
                fallback={
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600">
                    <span role="img" aria-label="filter">
                      🧩
                    </span>
                    <span>Dealbreakers</span>
                    <span className="ml-1 text-[10px] text-amber-700">Premium</span>
                  </span>
                }
              >
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-pink-600 text-white">
                  <span role="img" aria-label="filter">
                    🧩
                  </span>
                  <span>Dealbreakers</span>
                </span>
              </FeatureGate>
            </div>

            {/* Main filters form */}
            <DiscoverFilters
              values={values}
              handleFilter={handleFilter}
              setters={setters}
              probeFocusProps={probeFocusProps}
            />
          </div>

          {/* Inline ad slot (hidden for Premium/no-ads via AdGate) */}
          <div className="max-w-3xl mx-auto w-full">
            <AdGate type="inline">
              <AdBanner
                imageSrc="/ads/ad-right1.png"
                headline="Sponsored"
                body="Upgrade to Premium to remove all ads."
              />
            </AdGate>
          </div>

          {/* Cards grid / skeleton / error */}
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
                    // (NEW) Forward likes quota to ProfileCardList → ProfileCard → ActionButtons.
                    likesLimitPerDay={likesLimitPerDay}
                    likesRemainingToday={likesRemainingToday}
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

        {/* Right ad column (placeholder, symmetrical with left) */}
        <aside className="hidden lg:block w-[200px] sticky top-[160px] space-y-6" />
      </div>

      {/* Upsell modal when like quota is exceeded for free users */}
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


