// ❗ Work-in-Progress Notes:
// 1. Aloitimme 'Tallenna'-toiminnon vianetsinnän: keräsimme payload- ja konsolilokit sekä handleSubmit-koodin.
// 2. FormLocation.jsx: yritimme estää kenttien nollaamisen useEffect-hookeilla mountin yhteydessä.
// 3. UseEffect-logiikka on osoittautunut liian monimutkaiseksi ja rikkoo region/city-pysyvyyden tallennuksen jälkeen.
// 4. Tavoitteena säilyttää country/region/city payloadissa ja formissa tallennuksen jälkeen, mutta kentät nollautuvat edelleen.
// Seuraava vaihe: yksinkertaistaa komponenttia poistamalla automaattiset reset-hookit ja luottaa RHF:n defaultValues/reset-mahdollisuuksiin.
// Kun tämä on tehty, testaa tallennus ja varmistetaan, että kaikki sijaintikentät palautuvat oikein.

import React, { useEffect, useRef } from "react";
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
  const region = watch("region");
  const customRegion = watch("customRegion");

        const regions = country ? countryRegions[country] || [] : [];
  const cities = country && region ? regionCities[country]?.[region] || [] : [];

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">{t("profile.location.country")}</label>
        <select {...register("country")} className="p-2 border rounded w-full">
          <option value="">{t("common.selectCountry")}</option>
          {Object.keys(countryRegions).map((c) => (
            <option key={c} value={c}>{t(`countries.${c}`, c)}</option>
          ))}
        </select>
        {errors.country && <p className="text-red-600 text-sm mt-1">{errors.country.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.manualCountry")}
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
          {regions.map((r) => (
            <option key={r} value={r}>{t(`regions.${r}`, r)}</option>
          ))}
        </select>
        {errors.region && <p className="text-red-600 text-sm mt-1">{errors.region.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.manualRegion")}
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
          {cities.map((ct) => (
            <option key={ct} value={ct}>{t(`cities.${ct}`, ct)}</option>
          ))}
        </select>
        {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city.message}</p>}
        <input
          type="text"
          placeholder={t("profile.location.manualCity")}
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
