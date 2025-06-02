import React from "react";
import { leftAds, rightAds } from "../utils/adsData";
import "../styles/ads.css";

const AdColumn = ({ side }) => {
  const ads = side === "left" ? leftAds : rightAds;

  return (
    <div className={`ad-column ${side}`}>
      {ads.slice(0, 2).map((ad, index) => (
        <div key={index} className="ad-wrapper">
          <img
            src={ad.src}
            alt={ad.alt || `Ad ${index + 1}`}
            className="ad-side"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};

export default AdColumn;
