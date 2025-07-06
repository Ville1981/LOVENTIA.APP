// src/components/profileFields/FormGoalSummary.jsx

import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormGoalSummary
 * Lomakeosio: profiilin kuvaus ja tavoitteet
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 */
const FormGoalSummary = ({ t }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Kuvaus */}
      <div className="w-full">
        <label htmlFor="summary" className="block font-medium mb-1">
          📄 {t("profile.about")}
        </label>
        <textarea
          id="summary"
          {...register("summary")}
          placeholder={t("profile.about")}
          className="p-2 border rounded w-full"
          rows={3}
        />
        {errors.summary && (
          <p className="mt-1 text-sm text-red-600">
            {errors.summary.message}
          </p>
        )}
      </div>

      {/* Tavoitteet */}
      <div className="w-full">
        <label htmlFor="goal" className="block font-medium mb-1">
          🎯 {t("profile.goals")}
        </label>
        <textarea
          id="goal"
          {...register("goal")}
          placeholder={t("profile.goals")}
          className="p-2 border rounded w-full"
          rows={3}
        />
        {errors.goal && (
          <p className="mt-1 text-sm text-red-600">
            {errors.goal.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default FormGoalSummary;
