// File: client/src/components/abTest/ABTest.jsx

// --- REPLACE START: use centralized axios instance ---
import axios from "../../utils/axiosInstance";
// --- REPLACE END ---
import React, { useEffect, useState } from "react";

/**
 * A/B test component
 * @param {string} experimentName
 * @param {object} variants Map variant-name → React component
 */
export function ABTest({ experimentName, variants }) {
  const [variantKey, setVariantKey] = useState(null);

  useEffect(() => {
    async function fetchVariant() {
      // Example: backend endpoint that returns user's variant
      const res = await api.get(`/api/abtest/${experimentName}`);
      setVariantKey(res.data.variant);
      // Track participation
      await api.post(`/api/abtest/${experimentName}/track`, {
        variant: res.data.variant,
      });
    }
    fetchVariant();
  }, [experimentName]);

  if (!variantKey || !variants[variantKey]) {
    return null; // or loader
  }
  const VariantComponent = variants[variantKey];
  return <VariantComponent />;
}

export default ABTest;
