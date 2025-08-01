// src/components/abTest/ABTest.jsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * A/B-testikomponentti
 * @param {string} experimentName
 * @param {object} variants Map variant-nimi → React-komponentti
 */
export function ABTest({ experimentName, variants }) {
  const [variantKey, setVariantKey] = useState(null);

  useEffect(() => {
    async function fetchVariant() {
      // Esimerkki: backend-endpoint jolla haetaan käyttäjän variantti
      const res = await axios.get(`/api/abtest/${experimentName}`);
      setVariantKey(res.data.variant);
      // Trackaa osallistuminen
      await axios.post(`/api/abtest/${experimentName}/track`, { variant: res.data.variant });
    }
    fetchVariant();
  }, [experimentName]);

  if (!variantKey || !variants[variantKey]) {
    return null; // tai loader
  }
  const VariantComponent = variants[variantKey];
  return <VariantComponent />;
}
