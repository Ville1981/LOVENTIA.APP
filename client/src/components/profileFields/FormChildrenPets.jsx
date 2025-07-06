// src/components/profileFields/FormChildrenPets.jsx

import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormChildrenPets
 * Lomakeosio: lapset ja lemmikit
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 */
const FormChildrenPets = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Lapset */}
      <div className="w-full">
        <label htmlFor="children" className="block font-medium mb-1">
          👶 {t("profile.children")}
        </label>
        <select
          id="children"
          {...register("children")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Kyllä">{t("profile.childrenYes")}</option>
          <option value="Ei">{t("profile.childrenNo")}</option>
          <option value="Aikuisia lapsia">{t("profile.childrenAdult")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
        {errors.children && (
          <p className="mt-1 text-sm text-red-600">
            {errors.children.message}
          </p>
        )}
      </div>

      {/* Lemmikit */}
      <div className="w-full">
        <label htmlFor="pets" className="block font-medium mb-1">
          🐾 {t("profile.pets")}
        </label>
        <select
          id="pets"
          {...register("pets")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Kissa">{t("pets.cat")}</option>
          <option value="Koira">{t("pets.dog")}</option>
          <option value="Molemmat">{t("pets.both")}</option>
          <option value="Muu">{t("common.other")}</option>
          <option value="Ei lemmikkiä">{t("pets.none")}</option>
        </select>
        {errors.pets && (
          <p className="mt-1 text-sm text-red-600">
            {errors.pets.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default FormChildrenPets;
