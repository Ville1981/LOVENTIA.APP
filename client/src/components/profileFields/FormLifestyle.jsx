// --- REPLACE START: i18n-safe labels, EN enum values, and search-mode validation gating (no required rules/attrs in search) ---
import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

// Base options for smoke, drink, drugs – values are EN enums expected by backend
const baseOptions = [
  { value: "no", labelKey: "lifestyle:no" },
  { value: "little", labelKey: "lifestyle:little" },
  { value: "average", labelKey: "lifestyle:average" },
  { value: "much", labelKey: "lifestyle:much" },
  { value: "sober", labelKey: "lifestyle:sober" },
];

// Dietary preferences (single-select) – EN enums
const dietOptions = [
  { value: "omnivore", labelKey: "lifestyle:dietOmnivore" },
  { value: "vegetarian", labelKey: "lifestyle:dietVegetarian" },
  { value: "vegan", labelKey: "lifestyle:dietVegan" },
  { value: "pescatarian", labelKey: "lifestyle:dietPescatarian" },
  { value: "keto", labelKey: "lifestyle:dietKeto" },
  { value: "other", labelKey: "common:other" },
];

// Exercise habits – EN enums
const exerciseOptions = [
  { value: "never", labelKey: "lifestyle:exerciseNever" },
  { value: "occasionally", labelKey: "lifestyle:exerciseOccasionally" },
  { value: "weekly", labelKey: "lifestyle:exerciseWeekly" },
  { value: "daily", labelKey: "lifestyle:exerciseDaily" },
];

/**
 * FormLifestyle
 * Section: smoking, alcohol, drugs + diet & exercise
 * Uses RHF context for field registration and error display.
 *
 * Props:
 *   t: i18n translate function (required)
 *   includeAllOption: add "All" option as the first item (default: false)
 *   disableValidation / mode="search": when active, do NOT register RHF required rules,
 *     do NOT add DOM `required` attributes, and avoid forced defaults that would
 *     make fields effectively mandatory in search mode.
 */
const FormLifestyle = ({
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

  // Compose select options lists
  const headOption = includeAllOption
    ? { value: "", labelKey: "common:all" }
    : { value: "", labelKey: "common:select" };
  const triadOptions = [headOption, ...baseOptions];

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormLifestyle__section">
      <h3 className="text-lg font-semibold mb-2" data-cy="FormLifestyle__title">
        {t("lifestyle:title")}
      </h3>

      {/* Smoke, Drink, Drugs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Smoke */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__smokeLabel">
            {t("lifestyle:smoke")}
          </label>
          <select
            {...register("smoke", withRules(/* e.g., { required: t('common:required') } */))}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__smokeSelect"
            required={false}
          >
            {triadOptions.map((opt) => (
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
            {t("lifestyle:drink")}
          </label>
          <select
            {...register("drink", withRules(/* e.g., { required: t('common:required') } */))}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__drinkSelect"
            required={false}
          >
            {triadOptions.map((opt) => (
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
            {t("lifestyle:drugs")}
          </label>
          <select
            {...register("drugs", withRules(/* e.g., { required: t('common:required') } */))}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__drugsSelect"
            required={false}
          >
            {triadOptions.map((opt) => (
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

      {/* Diet & Exercise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Dietary Preferences (single-select) */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__dietLabel">
            {t("lifestyle:diet")}
          </label>
          <select
            {...register("nutritionPreferences", withRules(/* e.g., { required: t('common:required') } */))}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__dietSelect"
            required={false}
          >
            <option value="">{t("common:select")}</option>
            {dietOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.nutritionPreferences && (
            <p className="mt-1 text-sm text-red-600" data-cy="FormLifestyle__dietError">
              {errors.nutritionPreferences.message}
            </p>
          )}
        </div>

        {/* Exercise Habits */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__exerciseLabel">
            {t("lifestyle:exercise")}
          </label>
          <select
            {...register("activityLevel", withRules(/* e.g., { required: t('common:required') } */))}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__exerciseSelect"
            required={false}
          >
            <option value="">{t("common:select")}</option>
            {exerciseOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          {errors.activityLevel && (
            <p className="mt-1 text-sm text-red-600" data-cy="FormLifestyle__exerciseError">
              {errors.activityLevel.message}
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
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormLifestyle;
// --- REPLACE END ---
