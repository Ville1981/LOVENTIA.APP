// src/components/profileFields/FormEducation.jsx

import React from 'react';
import { useFormContext } from 'react-hook-form';
import PropTypes from 'prop-types';

/**
 * FormEducation
 * Lomakeosio: koulutus (vain)
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 *
 * Props:
 *   t: lokalisointifunktio (required)
 *   includeAllOption: lisää "All"–valinnan ylös (oletus: false)
 */
const FormEducation = ({ t, includeAllOption = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormEducation__section">
      {/* Koulutustaso */}
      <div className="w-full">
        <label htmlFor="education" className="block font-medium mb-1">
          🎓 {t('profile.education')}
        </label>
        <select
          id="education"
          {...register('education')}
          className="p-2 border rounded w-full"
          data-cy="FormEducation__educationSelect"
        >
          {includeAllOption && <option value="">{t('common.all')}</option>}
          <option value="">{t('common.select')}</option>
          <option value="Peruskoulu">{t('education.basic')}</option>
          <option value="Toinen aste">{t('education.secondary')}</option>
          <option value="Ammatillinen">{t('education.vocational')}</option>
          <option value="Korkeakoulu / yliopisto">{t('education.higher')}</option>
          <option value="Tohtori / tutkimus">{t('education.phd')}</option>
          <option value="Muu">{t('common.other')}</option>
        </select>
        {errors.education && (
          <p className="mt-1 text-sm text-red-600" data-cy="FormEducation__educationError">
            {errors.education.message}
          </p>
        )}
      </div>
    </div>
  );
};

FormEducation.propTypes = {
  t: PropTypes.func.isRequired,
  includeAllOption: PropTypes.bool,
};

export default FormEducation;
