// src/components/profileFields/FormLifestyle.jsx

import React from "react";
import { useFormContext } from "react-hook-form";

const lifestyleOptions = [
  { value: "", labelKey: "common.select" },
  { value: "no", labelKey: "lifestyle.no" },
  { value: "little", labelKey: "lifestyle.little" },
  { value: "average", labelKey: "lifestyle.average" },
  { value: "much", labelKey: "lifestyle.much" },
  { value: "sober", labelKey: "lifestyle.sober" },
];

/**
 * FormLifestyle
 * Lomakeosio: tupakointi, alkoholi ja huumeet
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 */
const FormLifestyle = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{t("lifestyle.title")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Smoke */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.smoke")}
          </label>
          <select
            {...register("smoke")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.smoke && (
            <p className="mt-1 text-sm text-red-600">{errors.smoke.message}</p>
          )}
        </div>

        {/* Drink */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.drink")}
          </label>
          <select
            {...register("drink")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.drink && (
            <p className="mt-1 text-sm text-red-600">{errors.drink.message}</p>
          )}
        </div>

        {/* Drugs */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.drugs")}
          </label>
          <select
            {...register("drugs")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.drugs && (
            <p className="mt-1 text-sm text-red-600">{errors.drugs.message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormLifestyle;
