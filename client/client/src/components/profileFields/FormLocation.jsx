import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";
import { countryRegions, regionCities } from "../../utils/locationData";

/**
 * FormLocation
 * Profiilisivun lomakeosio: maa, alue, kaupunki
 *
 * Props:
 *  - t: lokalisointifunktio
 *  - countryFieldName, regionFieldName, cityFieldName: kenttien nimet
 *  - customCountryFieldName, customRegionFieldName, customCityFieldName: vapaateksti-kenttien nimet
 *  - includeAllOption: lisätään “All”-valinta dropdowniin
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
}) => {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const country      = watch(countryFieldName);
  const region       = watch(regionFieldName);
  const customRegion = watch(customRegionFieldName);

  const regions = country ? countryRegions[country] || [] : [];
  const cities  = country && region
    ? regionCities[country]?.[region] || []
    : [];

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">
          🌍 {t("profile.location.country")}
        </label>
        <select
          {...register(countryFieldName)}
          className="p-2 border rounded w-full"
        >
          {includeAllOption && <option value="">{t("common.all")}</option>}
          <option value="">{t("common.selectCountry")}</option>
          {Object.keys(countryRegions).map(c => (
            <option key={c} value={c}>
              {t(`countries.${c}`, c)}
            </option>
          ))}
        </select>
        {errors[countryFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[countryFieldName].message}
          </p>
        )}
        <input
          type="text"
          placeholder={t("profile.location.manualCountry")}
          {...register(customCountryFieldName)}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors[customCountryFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[customCountryFieldName].message}
          </p>
        )}
      </div>

      {/* Region */}
      <div>
        <label className="block font-medium mb-1">
          🗺 {t("profile.location.region")}
        </label>
        <select
          {...register(regionFieldName)}
          disabled={!country}
          className="p-2 border rounded w-full"
        >
          {includeAllOption && <option value="">{t("common.all")}</option>}
          <option value="">{t("common.selectRegion")}</option>
          {regions.map(r => (
            <option key={r} value={r}>
              {t(`regions.${r}`, r)}
            </option>
          ))}
        </select>
        {errors[regionFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[regionFieldName].message}
          </p>
        )}
        <input
          type="text"
          placeholder={t("profile.location.manualRegion")}
          {...register(customRegionFieldName)}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors[customRegionFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[customRegionFieldName].message}
          </p>
        )}
      </div>

      {/* City */}
      <div>
        <label className="block font-medium mb-1">
          🏩 {t("profile.location.city")}
        </label>
        <select
          {...register(cityFieldName)}
          disabled={!region && !customRegion}
          className="p-2 border rounded w-full"
        >
          {includeAllOption && <option value="">{t("common.all")}</option>}
          <option value="">{t("common.selectCity")}</option>
          {cities.map(ct => (
            <option key={ct} value={ct}>
              {t(`cities.${ct}`, ct)}
            </option>
          ))}
        </select>
        {errors[cityFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[cityFieldName].message}
          </p>
        )}
        <input
          type="text"
          placeholder={t("profile.location.manualCity")}
          {...register(customCityFieldName)}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors[customCityFieldName] && (
          <p className="text-red-600 text-sm mt-1">
            {errors[customCityFieldName].message}
          </p>
        )}
      </div>
    </div>
  );
};

FormLocation.propTypes = {
  t: PropTypes.func.isRequired,
  countryFieldName:       PropTypes.string.isRequired,
  regionFieldName:        PropTypes.string.isRequired,
  cityFieldName:          PropTypes.string.isRequired,
  customCountryFieldName: PropTypes.string.isRequired,
  customRegionFieldName:  PropTypes.string.isRequired,
  customCityFieldName:    PropTypes.string.isRequired,
  includeAllOption:       PropTypes.bool,
};

export default FormLocation;
