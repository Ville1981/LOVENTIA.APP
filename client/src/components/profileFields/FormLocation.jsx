// client/src/components/profileFields/FormLocation.jsx

import React from "react";
import { countryRegions, regionCities } from "../../utils/locationData";

const FormLocation = ({ values, setters, t }) => {
  // setters is the setValues function from useState in parent
  const setValues = setters;
  const {
    country,
    region,
    city,
    customCountry,
    customRegion,
    customCity,
  } = values;

  // Options for region and city based on selected country and region
  const regionOptions = country ? countryRegions[country] || [] : [];
  const cityOptions =
    country && region
      ? regionCities[country]?.[region] || []
      : [];

  // Handlers for dropdown and manual inputs
  const handleCountryChange = (e) => {
    const country = e.target.value;
    setValues((prev) => ({
      ...prev,
      country,
      region: "",
      city: "",
      customCountry: "",
    }));
  };

  const handleRegionChange = (e) => {
    const region = e.target.value;
    setValues((prev) => ({
      ...prev,
      region,
      city: "",
      customRegion: "",
    }));
  };

  const handleCityChange = (e) => {
    const city = e.target.value;
    setValues((prev) => ({ ...prev, city, customCity: "" }));
  };

  const handleCustomCountryChange = (e) => {
    const customCountry = e.target.value;
    setValues((prev) => ({ ...prev, customCountry }));
  };

  const handleCustomRegionChange = (e) => {
    const customRegion = e.target.value;
    setValues((prev) => ({ ...prev, customRegion }));
  };

  const handleCustomCityChange = (e) => {
    const customCity = e.target.value;
    setValues((prev) => ({ ...prev, customCity }));
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
