// src/components/profileFields/FormEducation.jsx

import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";

/**
 * FormEducation
 * Lomakeosio: koulutus, ammatti, uskonto ja uskonnon merkitys
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 */
const FormEducation = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Koulutustaso */}
      <div className="w-full">
        <label htmlFor="education" className="block font-medium mb-1">
          🎓 {t("profile.education")}
        </label>
        <select
          id="education"
          {...register("education")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Peruskoulu">{t("education.basic")}</option>
          <option value="Toinen aste">{t("education.secondary")}</option>
          <option value="Ammatillinen">{t("education.vocational")}</option>
          <option value="Korkeakoulu / yliopisto">{t("education.higher")}</option>
          <option value="Tohtori / tutkimus">{t("education.phd")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
        {errors.education && (
          <p className="mt-1 text-sm text-red-600">
            {errors.education.message}
          </p>
        )}
      </div>

      {/* Ammatti */}
      <div className="w-full">
        <label htmlFor="profession" className="block font-medium mb-1">
          💼 {t("profile.profession")}
        </label>
        <input
          type="text"
          id="profession"
          {...register("profession")}
          placeholder={t("profile.profession")}
          className="p-2 border rounded w-full"
        />
        {errors.profession && (
          <p className="mt-1 text-sm text-red-600">
            {errors.profession.message}
          </p>
        )}
      </div>

      {/* Uskonto */}
      <div className="w-full">
        <label htmlFor="religion" className="block font-medium mb-1">
          🕊 {t("profile.religion")}
        </label>
        <select
          id="religion"
          {...register("religion")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Kristinusko">{t("religion.christianity")}</option>
          <option value="Islam">{t("religion.islam")}</option>
          <option value="Hindulaisuus">{t("religion.hinduism")}</option>
          <option value="Buddhalaisuus">{t("religion.buddhism")}</option>
          <option value="Kansanusko">{t("religion.folk")}</option>
          <option value="Uskonnottomuus">{t("religion.none")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
        {errors.religion && (
          <p className="mt-1 text-sm text-red-600">
            {errors.religion.message}
          </p>
        )}
      </div>

      {/* Uskonnon merkitys */}
      <div className="w-full">
        <label htmlFor="religionImportance" className="block font-medium mb-1">
          🕊 {t("profile.religionImportance")}
        </label>
        <select
          id="religionImportance"
          {...register("religionImportance")}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Ei tärkeä">{t("religionImportance.notImportant")}</option>
          <option value="Jonkin verran tärkeä">
            {t("religionImportance.somewhatImportant")}
          </option>
          <option value="Erittäin tärkeä">{t("religionImportance.veryImportant")}</option>
        </select>
        {errors.religionImportance && (
          <p className="mt-1 text-sm text-red-600">
            {errors.religionImportance.message}
          </p>
        )}
      </div>
    </div>
  );
};

FormEducation.propTypes = {
  t: PropTypes.func.isRequired,
};

export default FormEducation;
