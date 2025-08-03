// src/components/featureToggle/FeatureToggleProvider.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const FeatureContext = createContext({});

export function FeatureToggleProvider({ children }) {
  const [flags, setFlags] = useState({});

  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await axios.get('/api/feature-flags');
        setFlags(res.data);
      } catch (err) {
        console.error('Feature flags fetch failed', err);
      }
    }
    fetchFlags();
  }, []);

  return (
    <FeatureContext.Provider value={flags}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatureFlag(flagName) {
  const flags = useContext(FeatureContext);
  return flags[flagName] === true;
}

