// src/components/profileFields/FormLocation.jsx

import React, { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";
import { countryRegions, regionCities } from "../../utils/locationData";

/**
 * FormLocation
 * Lomakeosio: käyttäjän sijainti (maa, alue, kaupunki)
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja riippuvuuksien hallintaan.
 */
const FormLocation = ({ t }) => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const country = watch("country");
  const customCountry = watch("customCountry");
  const region = watch("region");
  const customRegion = watch("customRegion");
  const city = watch("city");
  const customCity = watch("customCity");

  // Reset dependent fields when parent changes
  useEffect(() => {
    if (country) {
      setValue("customCountry", "");
      setValue("region", "");
      setValue("city", "");
      setValue("customRegion", "");
      setValue("customCity", "");
    }
  }, [country, setValue]);

  useEffect(() => {
    if (region) {
      setValue("customRegion", "");
      setValue("city", "");
      setValue("customCity", "");
    }
  }, [region, setValue]);

  useEffect(() => {
    if (customCountry) {
      setValue("country", "");
      setValue("region", "");
      setValue("city", "");
      setValue("customRegion", "");
      setValue("customCity", "");
    }
  }, [customCountry, setValue]);

  useEffect(() => {
    if (customRegion) {
      setValue("city", "");
      setValue("customCity", "");
    }
  }, [customRegion, setValue]);

  const regionOptions = country ? countryRegions[country] || [] : [];
  const cityOptions = country && region ? regionCities[country]?.[region] || [] : [];

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">{t("profile.location.country")}</label>
        <select
          {...register("country")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.selectCountry")}</option>
          {Object.keys(countryRegions).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.country && <p className="text-red-600 text-sm mt-1">{errors.country.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.otherCountry")}
          {...register("customCountry")}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors.customCountry && <p className="text-red-600 text-sm mt-1">{errors.customCountry.message}</p>}
      </div>

      {/* Region */}
      <div>
        <label className="block font-medium mb-1">{t("profile.location.region")}</label>
        <select
          {...register("region")}
          disabled={!country}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.selectRegion")}</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {errors.region && <p className="text-red-600 text-sm mt-1">{errors.region.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.otherRegion")}
          {...register("customRegion")}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors.customRegion && <p className="text-red-600 text-sm mt-1">{errors.customRegion.message}</p>}
      </div>

      {/* City */}
      <div>
        <label className="block font-medium mb-1">{t("profile.location.city")}</label>
        <select
          {...register("city")}
          disabled={!region && !customRegion}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.selectCity")}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.otherCity")}
          {...register("customCity")}
          className="mt-2 p-2 border rounded w-full"
        />
        {errors.customCity && <p className="text-red-600 text-sm mt-1">{errors.customCity.message}</p>}
      </div>
    </div>
  );
};

FormLocation.propTypes = {
  t: PropTypes.func.isRequired,
};

export default FormLocation;
