import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormChildrenPets
 * Form section: children and pets
 * Uses RHF context for field registration and error display.
 *
 * Props:
 *   t: i18n translate function (required)
 *   includeAllOption: adds an "All" option at the top (default false)
 */
const FormChildrenPets = ({ t, includeAllOption = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div
      className="flex flex-col gap-4 w-full text-left"
      data-cy="FormChildrenPets__section"
    >
      {/* Children */}
      <div className="w-full">
        <label htmlFor="children" className="block font-medium mb-1">
          👶 {t("profile:children")}
        </label>
        <select
          id="children"
          {...register("children")}
          className="p-2 border rounded w-full"
          data-cy="FormChildrenPets__childrenSelect"
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:select")}</option>

          {/* --- REPLACE START: values are EN constants; labels can be localized --- */}
          {/* Do NOT change these values; backend expects EN keys */}
          <option value="yes">{t("profile:childrenYes")}</option>
          <option value="no">{t("profile:childrenNo")}</option>
          <option value="adult_kids">{t("profile:childrenAdult")}</option>
          <option value="other">{t("common:other")}</option>
          {/* --- REPLACE END --- */}
        </select>
        {errors.children && (
          <p
            className="mt-1 text-sm text-red-600"
            data-cy="FormChildrenPets__childrenError"
          >
            {errors.children.message}
          </p>
        )}
      </div>

      {/* Pets */}
      <div className="w-full">
        <label htmlFor="pets" className="block font-medium mb-1">
          🐾 {t("profile:pets")}
        </label>
        <select
          id="pets"
          {...register("pets")}
          className="p-2 border rounded w-full"
          data-cy="FormChildrenPets__petsSelect"
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:select")}</option>

          {/* --- REPLACE START: unify to EN values; labels translated through i18n --- */}
          <option value="cat">{t("profile:options.pets.cat")}</option>
          <option value="dog">{t("profile:options.pets.dog")}</option>
          <option value="both">{t("profile:options.pets.both")}</option>
          <option value="other">{t("common:other")}</option>
          <option value="none">{t("profile:options.pets.none")}</option>
          {/* --- REPLACE END --- */}
        </select>
        {errors.pets && (
          <p
            className="mt-1 text-sm text-red-600"
            data-cy="FormChildrenPets__petsError"
          >
            {errors.pets.message}
          </p>
        )}
      </div>
    </div>
  );
};

FormChildrenPets.propTypes = {
  t: PropTypes.func.isRequired,
  includeAllOption: PropTypes.bool,
};

export default FormChildrenPets;

