// client/src/components/profileFields/FormLocation.jsx

import React from "react";
import { countryRegions, regionCities } from "../../utils/locationData";

const FormLocation = ({ values, setters, t }) => {
  const setValues = setters;
  const {
    country,
    region,
    city,
    customCountry,
    customRegion,
    customCity,
  } = values;

  const regionOptions = country ? countryRegions[country] || [] : [];
  const cityOptions =
    country && region
      ? regionCities[country]?.[region] || []
      : [];

  const handleCountryChange = (e) => {
    const nextCountry = e.target.value;
    if (nextCountry !== country) {
      setValues((prev) => ({
        ...prev,
        country: nextCountry,
        region: "",
        city: "",
        customCountry: "",
      }));
    }
  };

  const handleRegionChange = (e) => {
    const nextRegion = e.target.value;
    if (nextRegion !== region) {
      setValues((prev) => ({
        ...prev,
        region: nextRegion,
        city: "",
        customRegion: "",
      }));
    }
  };

  const handleCityChange = (e) => {
    const nextCity = e.target.value;
    if (nextCity !== city) {
      setValues((prev) => ({ ...prev, city: nextCity, customCity: "" }));
    }
  };

  const handleCustomCountryChange = (e) => {
    setValues((prev) => ({ ...prev, customCountry: e.target.value }));
  };

  const handleCustomRegionChange = (e) => {
    setValues((prev) => ({ ...prev, customRegion: e.target.value }));
  };

  const handleCustomCityChange = (e) => {
    setValues((prev) => ({ ...prev, customCity: e.target.value }));
  };

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div className="w-full">
        <label htmlFor="country" className="block font-medium mb-1">
          🌍 {t("profile.country")}
        </label>
        <select
          id="country"
          value={country}
          onChange={handleCountryChange}
          className="p-2 border rounded w-full"
          aria-label={t("profile.selectCountry")}
        >
          <option value="">{t("profile.selectCountry")}</option>
          {Object.keys(countryRegions).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualCountry")}
          value={customCountry}
          onChange={handleCustomCountryChange}
          className="mt-2 p-2 border rounded w-full"
          aria-label={t("profile.manualCountry")}
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
          onChange={handleRegionChange}
          className="p-2 border rounded w-full"
          aria-label={t("profile.selectRegion")}
          disabled={!country}
        >
          <option value="">{t("profile.selectRegion")}</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualRegion")}
          value={customRegion}
          onChange={handleCustomRegionChange}
          className="mt-2 p-2 border rounded w-full"
          aria-label={t("profile.manualRegion")}
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
          onChange={handleCityChange}
          className="p-2 border rounded w-full"
          aria-label={t("profile.selectCity")}
          disabled={!region}
        >
          <option value="">{t("profile.selectCity")}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("profile.manualCity")}
          value={customCity}
          onChange={handleCustomCityChange}
          className="mt-2 p-2 border rounded w-full"
          aria-label={t("profile.manualCity")}
        />
      </div>
    </div>
  );
};

export default FormLocation;
