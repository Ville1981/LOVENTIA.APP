// --- REPLACE START: search-mode validation gating (no required rules/attrs in search), keep labels i18n-safe ---
import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormLookingFor
 * Section for "what you are looking for" in your profile.
 * Uses React Hook Form context to register fields and display errors.
 *
 * Props:
 *   t: localization function (required)
 *   fieldName: the field name for the select input (default: "lookingFor")
 *   disableValidation / mode="search": when active, do NOT register RHF required rules,
 *     do NOT add DOM `required` attributes, and avoid forced defaults that would
 *     make fields effectively mandatory in search mode.
 */
const FormLookingFor = ({
  t,
  fieldName = "lookingFor",
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

  // Options for what the user is looking for (values are EN enums for backend)
  const options = [
    { value: "", label: t("common:all") },
    { value: "Friendship", label: t("looking.friendship") },
    { value: "Getting to Know", label: t("looking.gettingToKnow") },
    { value: "Dating", label: t("looking.dating") },
    { value: "Dates", label: t("looking.dates") },
    { value: "Long-Term Relationship", label: t("looking.longTerm") },
    { value: "Marriage", label: t("looking.marriage") },
    { value: "Chat Only", label: t("looking.chatOnly") },
    { value: "Casual", label: t("looking.casual") },
    { value: "Undecided", label: t("looking.undecided") },
    { value: "Other", label: t("common:other") },
  ];

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormLookingFor__section">
      <label
        htmlFor={fieldName}
        className="block font-medium mb-1"
        data-cy="FormLookingFor__label"
      >
        🔍 {t("profile:searchingFor")}
      </label>

      <select
        id={fieldName}
        {...register(fieldName, withRules(/* e.g., { required: t('common:required') } */))}
        className="p-2 border rounded w-full"
        data-cy="FormLookingFor__select"
        required={false}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {errors[fieldName] && (
        <p className="mt-1 text-sm text-red-600" data-cy="FormLookingFor__error">
          {errors[fieldName].message}
        </p>
      )}
    </div>
  );
};

FormLookingFor.propTypes = {
  t: PropTypes.func.isRequired,
  fieldName: PropTypes.string,
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormLookingFor;
// --- REPLACE END ---
