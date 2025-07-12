// src/components/profileFields/FormLifestyle.jsx

import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";

const baseOptions = [
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
 *
 * Props:
 *   t: lokalisointifunktio (required)
 *   includeAllOption: lisätään “All”–valinta ensimmäiseksi (default: false)
 */
const FormLifestyle = ({ t, includeAllOption = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Kokoa vaihtoehdot: ensin “All” jos tarvitaan, sitten tyypilliset
  const options = includeAllOption
    ? [{ value: "", labelKey: "common.all" }, ...baseOptions]
    : [{ value: "", labelKey: "common.select" }, ...baseOptions];

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormLifestyle__section">
      <h3 className="text-lg font-semibold mb-2" data-cy="FormLifestyle__title">
        {t("lifestyle.title")}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Smoke */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__smokeLabel">
            {t("lifestyle.smoke")}
          </label>
          <select
            {...register("smoke")}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__smokeSelect"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.smoke && (
            <p className="mt-1 text-sm text-red-600" data-cy="FormLifestyle__smokeError">
              {errors.smoke.message}
            </p>
          )}
        </div>

        {/* Drink */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__drinkLabel">
            {t("lifestyle.drink")}
          </label>
          <select
            {...register("drink")}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__drinkSelect"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.drink && (
            <p className="mt-1 text-sm text-red-600" data-cy="FormLifestyle__drinkError">
              {errors.drink.message}
            </p>
          )}
        </div>

        {/* Drugs */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__drugsLabel">
            {t("lifestyle.drugs")}
          </label>
          <select
            {...register("drugs")}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__drugsSelect"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.drugs && (
            <p className="mt-1 text-sm text-red-600" data-cy="FormLifestyle__drugsError">
              {errors.drugs.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

FormLifestyle.propTypes = {
  t: PropTypes.func.isRequired,
  includeAllOption: PropTypes.bool,
};

export default FormLifestyle;
