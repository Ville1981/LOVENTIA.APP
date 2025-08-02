import React from 'react';
import { useFormContext } from 'react-hook-form';
import PropTypes from 'prop-types';

// Base options for smoke, drink, drugs
const baseOptions = [
  { value: 'no', labelKey: 'lifestyle.no' },
  { value: 'little', labelKey: 'lifestyle.little' },
  { value: 'average', labelKey: 'lifestyle.average' },
  { value: 'much', labelKey: 'lifestyle.much' },
  { value: 'sober', labelKey: 'lifestyle.sober' },
];

// Options for dietary preferences (single-select)
const dietOptions = [
  { value: 'omnivore', labelKey: 'lifestyle.dietOmnivore' },
  { value: 'vegetarian', labelKey: 'lifestyle.dietVegetarian' },
  { value: 'vegan', labelKey: 'lifestyle.dietVegan' },
  { value: 'pescatarian', labelKey: 'lifestyle.dietPescatarian' },
  { value: 'keto', labelKey: 'lifestyle.dietKeto' },
  { value: 'other', labelKey: 'common.other' },
];

// New options for exercise habits
const exerciseOptions = [
  { value: 'never', labelKey: 'lifestyle.exerciseNever' },
  { value: 'occasionally', labelKey: 'lifestyle.exerciseOccasionally' },
  { value: 'weekly', labelKey: 'lifestyle.exerciseWeekly' },
  { value: 'daily', labelKey: 'lifestyle.exerciseDaily' },
];

/**
 * FormLifestyle
 * Lomakeosio: tupakointi, alkoholi ja huumeet + ruokavalio ja liikuntatottumukset
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 *
 * Props:
 *   t: lokalisointifunktio (required)
 *   includeAllOption: lisätään "All"–valinta ensimmäiseksi (default: false)
 */
const FormLifestyle = ({ t, includeAllOption = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Kokoa vaihtoehdot: ensin "All" jos tarvitaan, sitten tyypilliset
  const options = includeAllOption
    ? [{ value: '', labelKey: 'common.all' }, ...baseOptions]
    : [{ value: '', labelKey: 'common.select' }, ...baseOptions];

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormLifestyle__section">
      <h3 className="text-lg font-semibold mb-2" data-cy="FormLifestyle__title">
        {t('lifestyle.title')}
      </h3>

      {/* Smoke, Drink, Drugs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Smoke */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__smokeLabel">
            {t('lifestyle.smoke')}
          </label>
          <select
            {...register('smoke')}
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
            {t('lifestyle.drink')}
          </label>
          <select
            {...register('drink')}
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
            {t('lifestyle.drugs')}
          </label>
          <select
            {...register('drugs')}
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

      {/* Diet & Exercise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Dietary Preferences (single-select) */}
        <div>
          <label className="block text-sm font-medium mb-1" data-cy="FormLifestyle__dietLabel">
            {t('lifestyle.diet')}
          </label>
          <select
            {...register('nutritionPreferences')}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__dietSelect"
          >
            <option value="">{t('common.select')}</option>
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
            {t('lifestyle.exercise')}
          </label>
          <select
            {...register('activityLevel')}
            className="w-full border rounded px-3 py-2 text-sm"
            data-cy="FormLifestyle__exerciseSelect"
          >
            <option value="">{t('common.select')}</option>
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
};

export default FormLifestyle;
