// client/src/components/profileFields/FormLocation.jsx

// --- REPLACE START (match Discover: normalize countries) ---
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
  void searchMode; // intentionally unused

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

  // Regions & cities are derived from the static maps (these may be empty for many countries).
  const regions = country ? countryRegions[country] || [] : [];
  const cities = country && region ? regionCities[country]?.[region] || [] : [];

  /**
   * fixMojibake
   * Lightweight normalization for a handful of known mojibake country names.
   * Keep this list short and focused on real-world occurrences we’ve seen.
   * We normalize *keys* so that t("countries:Åland Islands") works even if
   * the source JSON had a mojibake variant.
   */
  const fixMojibake = (s) => {
    if (typeof s !== "string" || !s) return s;

    // Phrase-level fixes first (more specific)
    const phraseMap = {
      "SÃ£o TomÃ© and PrÃ­ncipe": "São Tomé and Príncipe",
      "Saint BarthÃ©lemy": "Saint Barthélemy",
      "CuraÃ§ao": "Curaçao",
      "RÃ©union": "Réunion",
      "Ã\u0085land Islands": "Åland Islands",
      "Ã…land Islands": "Åland Islands",
    };
    if (phraseMap[s]) return phraseMap[s];

    // Character-level common fixes (subset; extend only when needed)
    const charPairs = [
      [/Ã©/g, "é"],
      [/Ã¨/g, "è"],
      [/Ãª/g, "ê"],
      [/Ã¡/g, "á"],
      [/Ãà/g, "à"],
      [/Ã¢/g, "â"],
      [/Ã£/g, "ã"],
      [/Ã³/g, "ó"],
      [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"],
      [/Ã­/g, "í"],
      [/Ã§/g, "ç"],
      [/Ã¼/g, "ü"],
      [/Ãœ/g, "Ü"],
      [/Ã¶/g, "ö"],
      [/Ã¤/g, "ä"],
      [/Ã¿/g, "ÿ"],
      [/Ãß/g, "ß"],
      [/Ã\u0085/g, "Å"], // rare escaped Å byte sequence
    ];
    let out = s;
    for (const [re, to] of charPairs) out = out.replace(re, to);
    return out;
  };

  // ---------------------------------------------------------------------------
  // Compute the FULL country code list for the <select>.
  // Root cause fixed here: previously we listed Object.keys(countryRegions),
  // which only contains countries that also have region data (~56).
  //
  // We prefer i18n's "countries" namespace as the authoritative full roster,
  // and only fall back to countryRegions keys if i18n is not available.
  // Sorting uses translated labels for a natural order in the active language.
  // Mojibake keys are normalized via fixMojibake() and de-duplicated with Set.
  // ---------------------------------------------------------------------------
  let fullCountryCodes = [];
  try {
    // Safely access global i18next if present (we do not import i18next to avoid duplicates).
    const i18nGlobal =
      typeof window !== "undefined" && window.i18next ? window.i18next : null;

    const activeLng = i18nGlobal?.language || "en";
    const i18nCountriesNs =
      i18nGlobal?.store?.data?.[activeLng]?.countries ||
      i18nGlobal?.store?.data?.en?.countries ||
      null;

    if (i18nCountriesNs && typeof i18nCountriesNs === "object") {
      // Normalize and dedupe keys to avoid mojibake variants producing duplicates.
      fullCountryCodes = [
        ...new Set(Object.keys(i18nCountriesNs).map((k) => fixMojibake(k))),
      ];
    } else {
      // Fallback: use the keys we have in the region map (legacy behavior).
      fullCountryCodes = Object.keys(countryRegions || {});
    }
  } catch (_e) {
    // As a final fallback, retain legacy behavior to avoid breaking the form.
    fullCountryCodes = Object.keys(countryRegions || {});
  }

  // Sort by translated display name (stable, locale-aware).
  const sortedCountryCodes = [...fullCountryCodes].sort((a, b) => {
    // Use namespace separator ":" for i18next (e.g. countries:Finland)
    const la = (t && typeof t === "function" ? t(`countries:${a}`, a) : a) || a;
    const lb = (t && typeof t === "function" ? t(`countries:${b}`, b) : b) || b;
    return String(la).localeCompare(String(lb));
  });

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

          {/* Use the full, sorted country set instead of Object.keys(countryRegions) */}
          {sortedCountryCodes.map((code) => (
            <option key={code} value={code}>
              {/* Correct i18n namespace separator ":" */}
              {t(`countries:${code}`, code)}
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
