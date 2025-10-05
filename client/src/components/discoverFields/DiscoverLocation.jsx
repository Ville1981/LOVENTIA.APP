// PATH: client/src/components/discoverFields/DiscoverLocation.jsx

// --- REPLACE START (normalize + sanitize countries + debug probes + stable callbacks) ---
import PropTypes from "prop-types";
import React, { useEffect, useMemo, useState, useCallback } from "react";

import { countryRegions, regionCities } from "../../utils/locationData";

/**
 * Debug probes: help diagnose unexpected auto-close of <select>.
 * These do not change behavior; they only log lifecycle & focus transitions.
 */
function useRenderProbe(name) {
  const countRef = React.useRef(0);
  useEffect(() => {
    countRef.current += 1;
    console.log(`[render] ${name} #${countRef.current}`);
  });
  useEffect(() => {
    console.log(`[mount] ${name}`);
    return () => console.log(`[unmount] ${name}`);
  }, [name]);
}
function useFocusProbe(tag) {
  return {
    onFocus: (e) => {
      const el = e?.target;
      console.log(`[focus] ${tag}`, { name: el?.name, value: el?.value, active: document.activeElement?.name });
    },
    onBlur: (e) => {
      const el = e?.target;
      console.log(`[blur ] ${tag}`, { name: el?.name, value: el?.value, active: document.activeElement?.name });
    },
  };
}

const DiscoverLocation = ({
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
}) => {
  // Access global i18next safely (no direct import to avoid duplicate singletons).
  const i18n = typeof window !== "undefined" && window.i18next ? window.i18next : null;

  // Safe translator helper: prefer i18n.t, otherwise fallback to provided default value.
  const _t = (key, defVal) => (i18n?.t ? i18n.t(key, { defaultValue: defVal }) : defVal);

  /**
   * fixMojibake
   * Lightweight normalization for a handful of known mojibake country names.
   * We fix the *keys* so lookups like t("countries:Åland Islands") succeed,
   * and we also get clean labels even if the store was loaded with bad keys.
   * Keep this list short and focused on real-world occurrences we’ve seen.
   */
  const fixMojibake = (s) => {
    if (typeof s !== "string" || !s) return s;
    const phraseMap = {
      "SÃ£o TomÃ© and PrÃ­ncipe": "São Tomé and Príncipe",
      "Saint BarthÃ©lemy": "Saint Barthélemy",
      "CuraÃ§ao": "Curaçao",
      "RÃ©union": "Réunion",
      "Ã\u0085land Islands": "Åland Islands",
      "Ã…land Islands": "Åland Islands",
    };
    if (phraseMap[s]) return phraseMap[s];
    const charPairs = [
      [/Ã©/g, "é"],
      [/Ã¨/g, "è"],
      [/Ãª/g, "ê"],
      [/Ã¡/g, "á"],
      [/Ã /gu, "à"],
      [/Ã¢/g, "â"],
      [/Ã£/g, "ã"],
      [/Ã–/g, "Ö"],
      [/Ã¼/gi, (m) => (m === "Ã¼" ? "ü" : "Ü")],
      [/Ã¶/g, "ö"],
      [/Ã¤/g, "ä"],
      [/Ã³/g, "ó"],
      [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"],
      [/Ãí/g, "í"],
      [/Ã§/g, "ç"],
      [/Ã¿/g, "ÿ"],
      [/ÃŸ/g, "ß"],
      [/Ã\u0085/g, "Å"], // rare escaped Å byte sequence
    ];
    let out = s;
    for (const [re, to] of charPairs) out = out.replace(re, to);
    return out;
  };

  // Preload the "countries" namespace. While loading, keep the dropdown disabled to
  // prevent the auto-close caused by late option injection.
  const [countriesReady, setCountriesReady] = useState(() => {
    const lng = i18n?.language || "en";
    const store = i18n?.store?.data?.[lng]?.countries || i18n?.store?.data?.en?.countries;
    return !!store && Object.keys(store || {}).length > 0;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (i18n?.loadNamespaces) {
          await i18n.loadNamespaces("countries");
          if (!alive) return;
          const lng = i18n?.language || "en";
          const store = i18n?.store?.data?.[lng]?.countries || i18n?.store?.data?.en?.countries;
          setCountriesReady(!!store && Object.keys(store || {}).length > 0);
        } else if (alive) {
          setCountriesReady(false);
        }
      } catch {
        if (alive) setCountriesReady(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [i18n?.language]);

  // Once ready, keep it sticky (do not flip back to false) to avoid disabling while a menu is open.
  const [readyOnce, setReadyOnce] = useState(countriesReady);
  useEffect(() => {
    if (countriesReady) setReadyOnce(true);
  }, [countriesReady]);

  // Build a FULL country roster for the dropdown.
  // Root cause before: Object.keys(countryRegions) only listed countries with region data (~56).
  // Fix: prefer i18n "countries" namespace as the authoritative full list;
  // normalize keys to fix mojibake; sort by translated labels.
  const sortedCountryCodes = useMemo(() => {
    if (readyOnce && i18n?.store?.data) {
      const lng = i18n?.language || "en";
      const i18nCountries =
        i18n.store.data?.[lng]?.countries || i18n.store.data?.en?.countries || {};
      const codes = [...new Set(Object.keys(i18nCountries).map(fixMojibake))];
      return codes.sort((a, b) => {
        const la = String(_t(`countries:${a}`, a));
        const lb = String(_t(`countries:${b}`, b));
        return la.localeCompare(lb);
      });
    }
    // Fallback while loading: keep empty to avoid option list popping in late.
    return [];
  }, [readyOnce, i18n?.language]);

  // Regions & cities from static maps — memoized to keep option arrays stable (prevents needless re-renders).
  const regionOptions = useMemo(() => {
    return country ? countryRegions[country] || [] : [];
  }, [country]);

  const cityOptions = useMemo(() => {
    return country && region ? regionCities[country]?.[region] || [] : [];
  }, [country, region]);

  // diagnostics (safe, no behavior change)
  useRenderProbe("CountrySelect");
  useRenderProbe("RegionSelect");
  useRenderProbe("CitySelect");
  const fpCountry = useFocusProbe("CountrySelect");
  const fpRegion = useFocusProbe("RegionSelect");
  const fpCity = useFocusProbe("CitySelect");

  // Stable change handlers (avoid new function identity each render)
  const handleCountryChange = useCallback(
    (e) => setCountry(e.target.value),
    [setCountry]
  );
  const handleRegionChange = useCallback(
    (e) => setRegion(e.target.value),
    [setRegion]
  );
  const handleCityChange = useCallback(
    (e) => setCity(e.target.value),
    [setCity]
  );

  // Note: do NOT add or change any `key` prop on the <select> elements below.
  // Keeping them stable in the DOM avoids native menu auto-closing due to remounts.
  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">
          🌍 {_t("profile:location.country", "Country")}
        </label>
        <select
          name="country"
          value={country}
          onChange={handleCountryChange}
          className="p-2 border rounded w-full"
          // Keep disabled until namespace is ready; stay enabled once ready to prevent auto-close.
          disabled={!readyOnce}
          {...fpCountry}
        >
          {/* Single placeholder row with robust fallback */}
          <option value="">
            {readyOnce
              ? _t("common:selectCountry", "Select country")
              : _t("common:loading", "Loading…")}
          </option>

          {readyOnce &&
            sortedCountryCodes.map((code) => (
              <option key={code} value={code}>
                {_t(`countries:${code}`, code)}
              </option>
            ))}
        </select>
        <input
          type="text"
          placeholder={_t("profile:location.manualCountry", "Other country")}
          value={customCountry}
          onChange={(e) => setCustomCountry(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>

      {/* Region */}
      <div>
        <label className="block font-medium mb-1">
          🗺 {_t("profile:location.region", "Region")}
        </label>
        <select
          name="region"
          value={region}
          onChange={handleRegionChange}
          disabled={!country}
          className="p-2 border rounded w-full"
          {...fpRegion}
        >
          <option value="">{_t("common:all", "All")}</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {_t(`regions.${r}`, r)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={_t("profile:location.manualRegion", "Other region")}
          value={customRegion}
          onChange={(e) => setCustomRegion(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>

      {/* City */}
      <div>
        <label className="block font-medium mb-1">
          🏩 {_t("profile:location.city", "City")}
        </label>
        <select
          name="city"
          value={city}
          onChange={handleCityChange}
          disabled={!region}
          className="p-2 border rounded w-full"
          {...fpCity}
        >
          <option value="">{_t("common:all", "All")}</option>
          {cityOptions.map((ct) => (
            <option key={ct} value={ct}>
              {_t(`cities.${ct}`, ct)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={_t("profile:location.manualCity", "Other city")}
          value={customCity}
          onChange={(e) => setCustomCity(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>
    </div>
  );
};

DiscoverLocation.propTypes = {
  country: PropTypes.string.isRequired,
  setCountry: PropTypes.func.isRequired,
  region: PropTypes.string.isRequired,
  setRegion: PropTypes.func.isRequired,
  city: PropTypes.string.isRequired,
  setCity: PropTypes.func.isRequired,
  customCountry: PropTypes.string.isRequired,
  setCustomCountry: PropTypes.func.isRequired,
  customRegion: PropTypes.string.isRequired,
  setCustomRegion: PropTypes.func.isRequired,
  customCity: PropTypes.string.isRequired,
  setCustomCity: PropTypes.func.isRequired,
};

export default DiscoverLocation;
// --- REPLACE END ---

