// src/components/HeaderAd.jsx

import React, { useEffect, useState } from 'react';
import * as adData from '../utils/adsData'; // ✅ korjattu import-polku

const HeaderAd = () => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);
  const ads = adData.headerAds;

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ads.length);
        setFade(false);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (!ads || ads.length === 0) return null;

  return (
    <div className="w-full bg-white pt-0 pb-4 shadow">
      <img
        src={ads[index]?.src || '/ads/header1.png'}
        alt={ads[index]?.alt || 'Mainos'}
        className={`ad-header ${fade ? 'fade-out' : ''}`}
      />
    </div>
  );
};

export default HeaderAd;
