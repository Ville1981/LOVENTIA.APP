import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";

/**
 * FormLookingFor
 * Section for "what you are looking for" in your profile.
 * Uses React Hook Form context to register fields and display errors.
 *
 * Props:
 *   t: localization function (required)
 *   fieldName: the field name for the select input (default: "lookingFor")
 */
const FormLookingFor = ({ t, fieldName = "lookingFor" }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Options for what the user is looking for
  const options = [
    { value: "", label: t("common.all") },
    { value: "Friendship", label: t("looking.friendship") },
    { value: "Getting to Know", label: t("looking.gettingToKnow") },
    { value: "Dating", label: t("looking.dating") },
    { value: "Dates", label: t("looking.dates") },
    { value: "Long-Term Relationship", label: t("looking.longTerm") },
    { value: "Marriage", label: t("looking.marriage") },
    { value: "Chat Only", label: t("looking.chatOnly") },
    { value: "Casual", label: t("looking.casual") },
    { value: "Undecided", label: t("looking.undecided") },
    { value: "Other", label: t("common.other") },
  ];

  return (
    <div
      className="flex flex-col gap-4 w-full text-left"
      data-cy="FormLookingFor__section"
    >
      <label
        htmlFor={fieldName}
        className="block font-medium mb-1"
        data-cy="FormLookingFor__label"
      >
        🔍 {t("profile.searchingFor")}
      </label>
      <select
        id={fieldName}
        {...register(fieldName)}
        className="p-2 border rounded w-full"
        data-cy="FormLookingFor__select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors[fieldName] && (
        <p
          className="mt-1 text-sm text-red-600"
          data-cy="FormLookingFor__error"
        >
          {errors[fieldName].message}
        </p>
      )}
    </div>
  );
};

FormLookingFor.propTypes = {
  t: PropTypes.func.isRequired,
  fieldName: PropTypes.string,
};

export default FormLookingFor;
