import React from "react";
import { countryRegions, regionCities } from "../../utils/locationData";

const FormLocation = ({
  country,
  region,
  city,
  customCountry,
  customRegion,
  customCity,
  setCountry,
  setRegion,
  setCity,
  setCustomCountry,
  setCustomRegion,
  setCustomCity,
  t,
}) => {
  const handleCountryChange = (e) => {
    const next = e.target.value;
    if (next !== country) {
      setCountry(next);
      setRegion("");
      setCity("");
      setCustomCountry("");
    }
  };

  const handleRegionChange = (e) => {
    const next = e.target.value;
    if (next !== region) {
      setRegion(next);
      setCity("");
      setCustomRegion("");
    }
  };

  const handleCityChange = (e) => {
    const next = e.target.value;
    if (next !== city) {
      setCity(next);
      setCustomCity("");
    }
  };

  const handleCustomCountryChange = (e) => {
    setCustomCountry(e.target.value);
    setCountry("");
    setRegion("");
    setCity("");
  };
  const handleCustomRegionChange = (e) => {
    setCustomRegion(e.target.value);
    setRegion("");
    setCity("");
  };
  const handleCustomCityChange = (e) => {
    setCustomCity(e.target.value);
    setCity("");
  };

  const regionOptions = country ? countryRegions[country] || [] : [];
  const cityOptions =
    country && region ? regionCities[country]?.[region] || [] : [];

  const hasCountry = country || customCountry;
  const hasRegion = region || customRegion;

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
          disabled={!hasCountry || regionOptions.length === 0}
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
          disabled={!hasRegion || cityOptions.length === 0}
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
        />
      </div>
    </div>
  );
};

export default FormLocation;
