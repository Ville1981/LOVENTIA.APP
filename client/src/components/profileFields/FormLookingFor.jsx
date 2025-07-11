import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormLookingFor
 * Lomakeosio: mitä etsit profiilissasi
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 */
const FormLookingFor = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const name = "lookingFor";
  const options = [
    { value: "", label: t("common.select") },
    { value: "Ystävää", label: t("looking.friend") },
    { value: "Tutustumassa", label: t("looking.gettingToKnow") },
    { value: "Deittailua", label: t("looking.dating") },
    { value: "Treffejä", label: t("looking.dates") },
    { value: "Pitkäaikaista suhdetta", label: t("looking.longTerm") },
    { value: "Pitkää vakavaa parisuhdetta / avioliittoa", label: t("looking.marriage") },
    { value: "Vain juttuseuraa / keskustelukaveria", label: t("looking.chatOnly") },
    { value: "Satunnaisia tapaamisia", label: t("looking.casual") },
    { value: "En tiedä vielä", label: t("looking.undecided") },
    { value: "Muu", label: t("common.other") },
  ];

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      <label htmlFor={name} className="block font-medium mb-1">
        🔍 {t("profile.searchingFor")}
      </label>
      <select
        id={name}
        {...register(name)}
        className="p-2 border rounded w-full"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600">
          {errors[name].message}
        </p>
      )}
    </div>
  );
};

export default FormLookingFor;
