// File: client/src/components/featureToggle/FeatureToggleProvider.jsx

// --- REPLACE START: use centralized axios instance ---
import axios from "../../utils/axiosInstance";
// --- REPLACE END ---
import React, { createContext, useContext, useEffect, useState } from "react";

const FeatureContext = createContext({});

export function FeatureToggleProvider({ children }) {
  const [flags, setFlags] = useState({});

  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await axios.get("/api/feature-flags");
        setFlags(res.data);
      } catch (err) {
        console.error("Feature flags fetch failed", err);
      }
    }
    fetchFlags();
  }, []);

  return (
    <FeatureContext.Provider value={flags}>{children}</FeatureContext.Provider>
  );
}

export function useFeatureFlag(flagName) {
  const flags = useContext(FeatureContext);
  return flags[flagName] === true;
}

export default FeatureToggleProvider;
