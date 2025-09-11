// --- REPLACE START: search-mode validation gating (no RHF required rules/DOM required in search mode) ---
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
 *   disableValidation / mode="search": when active, do NOT register RHF required rules,
 *     do NOT add DOM `required` attributes, and avoid forced defaults that would
 *     make fields effectively mandatory in search mode.
 */
const FormChildrenPets = ({
  t,
  includeAllOption = false,
  disableValidation = false,
  mode = undefined,
}) => {
  // In search mode we suppress any validation rules and DOM `required` attributes.
  const searchMode = !!disableValidation || mode === "search";

  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Helper to conditionally apply rules (future-proof if rules are added later).
  const withRules = (rules) => (searchMode ? {} : rules || {});

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormChildrenPets__section">
      {/* Children */}
      <div className="w-full">
        <label htmlFor="children" className="block font-medium mb-1">
          👶 {t("profile:children")}
        </label>
        <select
          id="children"
          {...register("children", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormChildrenPets__childrenSelect"
          required={false}
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:select")}</option>

          {/* Values are EN constants; labels are localized via i18n */}
          <option value="yes">{t("profile:childrenYes")}</option>
          <option value="no">{t("profile:childrenNo")}</option>
          <option value="adult_kids">{t("profile:childrenAdult")}</option>
          <option value="other">{t("common:other")}</option>
        </select>
        {errors.children && (
          <p className="mt-1 text-sm text-red-600" data-cy="FormChildrenPets__childrenError">
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
          {...register("pets", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormChildrenPets__petsSelect"
          required={false}
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:select")}</option>

          {/* Unified to EN values; labels translated through i18n */}
          <option value="cat">{t("profile:options.pets.cat")}</option>
          <option value="dog">{t("profile:options.pets.dog")}</option>
          <option value="both">{t("profile:options.pets.both")}</option>
          <option value="other">{t("common:other")}</option>
          <option value="none">{t("profile:options.pets.none")}</option>
        </select>
        {errors.pets && (
          <p className="mt-1 text-sm text-red-600" data-cy="FormChildrenPets__petsError">
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
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormChildrenPets;
// --- REPLACE END ---

