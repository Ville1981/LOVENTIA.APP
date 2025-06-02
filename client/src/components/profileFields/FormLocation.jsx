import React from "react";
import { countryRegions, regionCities } from "../../utils/locationData";

const FormLocation = ({
  country,
  setCountry,
  region,
  setRegion,
  city,
  setCity,
  customCountry,
  setCustomCountry,
  customRegion,
  setCustomRegion,
  customCity,
  setCustomCity,
  t
}) => {
  const regionOptions = countryRegions[country] || [];
  const cityOptions = regionCities?.[country]?.[region] || [];

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Country */}
      <div className="w-full">
        <label htmlFor="country" className="block font-medium mb-1">
          🌍 {t("profile.country")}
        </label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("profile.selectCountry")}</option>
          {Object.keys(countryRegions).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualCountry")}
          value={customCountry}
          onChange={(e) => setCustomCountry(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
        />
      </div>

      {/* Region */}
      <div className="w-full">
        <label htmlFor="region" className="block font-medium mb-1">
          🗺 {t("profile.region")}
        </label>
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("profile.selectRegion")}</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualRegion")}
          value={customRegion}
          onChange={(e) => setCustomRegion(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
        />
      </div>

      {/* City */}
      <div className="w-full">
        <label htmlFor="city" className="block font-medium mb-1">
          🏩 {t("profile.city")}
        </label>
        <select
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("profile.selectCity")}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualCity")}
          value={customCity}
          onChange={(e) => setCustomCity(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
        />
      </div>
    </div>
  );
};

export default FormLocation;
