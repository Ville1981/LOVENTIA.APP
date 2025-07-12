// src/components/profileFields/FormLookingFor.jsx

import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";

/**
 * FormLookingFor
 * Lomakeosio: mitä etsit profiilissasi
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 *
 * Props:
 *   t: lokalisointifunktio (required)
 */
const FormLookingFor = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const name = "lookingFor";
  const options = [
    // Lisätty "All" -vaihtoehto
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
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormLookingFor__section">
      <label htmlFor={name} className="block font-medium mb-1" data-cy="FormLookingFor__label">
        🔍 {t("profile.searchingFor")}
      </label>
      <select
        id={name}
        {...register(name)}
        className="p-2 border rounded w-full"
        data-cy="FormLookingFor__select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600" data-cy="FormLookingFor__error">
          {errors[name].message}
        </p>
      )}
    </div>
  );
};

FormLookingFor.propTypes = {
  t: PropTypes.func.isRequired,
};

export default FormLookingFor;
