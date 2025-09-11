// --- REPLACE START: add search-mode/validation props + keep DOM free of required attrs in search mode ---
import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

import { countryRegions, regionCities } from "../../utils/locationData";

/**
 * FormLocation
 * Profile form section: country, region, city
 *
 * Props:
 *  - t: i18n function
 *  - countryFieldName, regionFieldName, cityFieldName: field names
 *  - customCountryFieldName, customRegionFieldName, customCityFieldName: free-text fallbacks
 *  - includeAllOption: add “All” option into selects
 *  - disableValidation / mode="search": when active, do NOT register RHF required rules and
 *    do NOT add DOM `required` attributes. This component already avoids `required`, but
 *    we expose the flag for parity with other profileFields.
 */
const FormLocation = ({
  t,
  countryFieldName,
  regionFieldName,
  cityFieldName,
  customCountryFieldName,
  customRegionFieldName,
  customCityFieldName,
  includeAllOption = false,
  disableValidation = false,
  mode = undefined,
}) => {
  // In search mode we avoid any required rules or forced defaults (kept for API parity).
  const searchMode = !!disableValidation || mode === "search";
  // NOTE: This file already does not set required rules/attributes. The flag is passed
  // for consistency with other components and to future-proof if validations are added later.

  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const country = watch(countryFieldName);
  const region = watch(regionFieldName);
  const customRegion = watch(customRegionFieldName);

  const regions = country ? countryRegions[country] || [] : [];
  const cities = country && region ? regionCities[country]?.[region] || [] : [];

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">🌍 {t("profile:location.country")}</label>
        <select
          {...register(countryFieldName /* no required in any mode */)}
          className="p-2 border rounded w-full"
          // Keep DOM free of required attr in search mode (we never set it here anyway)
          required={false}
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:selectCountry")}</option>
          {Object.keys(countryRegions).map((c) => (
            <option key={c} value={c}>
              {t(`countries.${c}`, c)}
            </option>
          ))}
        </select>
        {errors[countryFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[countryFieldName].message}</p>
        )}

        <input
          type="text"
          placeholder={t("profile:location.manualCountry")}
          {...register(customCountryFieldName /* no required in any mode */)}
          className="mt-2 p-2 border rounded w-full"
          required={false}
        />
        {errors[customCountryFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[customCountryFieldName].message}</p>
        )}
      </div>

      {/* Region */}
      <div>
        <label className="block font-medium mb-1">🗺 {t("profile:location.region")}</label>
        <select
          {...register(regionFieldName /* no required in any mode */)}
          disabled={!country}
          className="p-2 border rounded w-full"
          required={false}
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:selectRegion")}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {t(`regions.${r}`, r)}
            </option>
          ))}
        </select>
        {errors[regionFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[regionFieldName].message}</p>
        )}

        <input
          type="text"
          placeholder={t("profile:location.manualRegion")}
          {...register(customRegionFieldName /* no required in any mode */)}
          className="mt-2 p-2 border rounded w-full"
          required={false}
        />
        {errors[customRegionFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[customRegionFieldName].message}</p>
        )}
      </div>

      {/* City */}
      <div>
        <label className="block font-medium mb-1">🏩 {t("profile:location.city")}</label>
        <select
          {...register(cityFieldName /* no required in any mode */)}
          disabled={!region && !customRegion}
          className="p-2 border rounded w-full"
          required={false}
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:selectCity")}</option>
          {cities.map((ct) => (
            <option key={ct} value={ct}>
              {t(`cities.${ct}`, ct)}
            </option>
          ))}
        </select>
        {errors[cityFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[cityFieldName].message}</p>
        )}

        <input
          type="text"
          placeholder={t("profile:location.manualCity")}
          {...register(customCityFieldName /* no required in any mode */)}
          className="mt-2 p-2 border rounded w-full"
          required={false}
        />
        {errors[customCityFieldName] && (
          <p className="text-red-600 text-sm mt-1">{errors[customCityFieldName].message}</p>
        )}
      </div>
    </div>
  );
};

FormLocation.propTypes = {
  t: PropTypes.func.isRequired,
  countryFieldName: PropTypes.string.isRequired,
  regionFieldName: PropTypes.string.isRequired,
  cityFieldName: PropTypes.string.isRequired,
  customCountryFieldName: PropTypes.string.isRequired,
  customRegionFieldName: PropTypes.string.isRequired,
  customCityFieldName: PropTypes.string.isRequired,
  includeAllOption: PropTypes.bool,
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormLocation;
// --- REPLACE END ---
