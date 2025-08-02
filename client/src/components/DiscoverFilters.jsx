import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import PropTypes from 'prop-types';

import FormBasicInfo from './profileFields/FormBasicInfo';
import FormLocation from './profileFields/FormLocation';
import FormEducation from './profileFields/FormEducation';
import FormChildrenPets from './profileFields/FormChildrenPets';
import FormLifestyle from './profileFields/FormLifestyle';
import FormGoalSummary from './profileFields/FormGoalSummary';
import FormLookingFor from './profileFields/FormLookingFor';

/**
 * DiscoverFilters
 * Haku- ja suodatuskomponentti React Hook Formilla
 */
const DiscoverFilters = ({ values, setters, handleFilter, t }) => {
  const methods = useForm({
    defaultValues: values,
    mode: 'onSubmit',
  });
  const { handleSubmit, register } = methods;

  return (
    <FormProvider {...methods}>
      <div className="w-full max-w-3xl mx-auto">
        <form
          data-cy="DiscoverFilters__form"
          onSubmit={handleSubmit(handleFilter)}
          className="flex flex-col gap-6"
        >
          {/* Otsikko ja ohjeet */}
          <div className="text-center">
            <h2 data-cy="DiscoverFilters__title" className="text-3xl font-bold mb-2">
              {t('discover.title')}
            </h2>
            <p data-cy="DiscoverFilters__instructions" className="text-gray-600">
              {t('discover.instructions')}
            </p>
          </div>

          {/* Ikähaitari: minAge ja maxAge */}
          <div className="flex flex-col gap-2">
            <label htmlFor="minAge" className="font-medium">
              {t('discover.ageRange')}
            </label>
            <div className="flex space-x-2">
              <input
                id="minAge"
                type="number"
                {...register('minAge')}
                min={18}
                max={120}
                className="p-2 border rounded w-1/2"
              />
              <input
                id="maxAge"
                type="number"
                {...register('maxAge')}
                min={18}
                max={120}
                className="p-2 border rounded w-1/2"
              />
            </div>
          </div>

          {/* Käyttäjänimi (vain hakuperusteena) */}
          <div>
            <label className="block font-medium mb-1">{t('discover.username')}</label>
            <input type="text" {...register('username')} className="w-full p-2 border rounded" />
          </div>

          {/* Sukupuoli */}
          <div>
            <label className="block font-medium mb-1">{t('discover.gender')}</label>
            <select {...register('gender')} className="w-full p-2 border rounded">
              <option value="">{t('common.all')}</option>
              <option value="Male">{t('profile.male')}</option>
              <option value="Female">{t('profile.female')}</option>
              <option value="Other">{t('profile.other')}</option>
            </select>
          </div>

          {/* Seksuaalinen suuntautuminen */}
          <div>
            <label className="block font-medium mb-1">❤️ {t('discover.orientation')}</label>
            <select {...register('orientation')} className="w-full p-2 border rounded">
              <option value="">{t('common.all')}</option>
              <option value="Straight">{t('profile.straight')}</option>
              <option value="Gay">{t('profile.gay')}</option>
              <option value="Bi">{t('profile.bi')}</option>
              <option value="Other">{t('profile.other')}</option>
            </select>
          </div>

          {/* Sijainti (country/region/city + manual) */}
          <FormLocation
            t={t}
            countryFieldName="country"
            regionFieldName="region"
            cityFieldName="city"
            customCountryFieldName="customCountry"
            customRegionFieldName="customRegion"
            customCityFieldName="customCity"
            includeAllOption
          />

          {/* Koulutus */}
          <FormEducation t={t} includeAllOption />

          {/* Ammatti */}
          <div>
            <label className="block font-medium mb-1">{t('discover.profession')}</label>
            <select {...register('profession')} className="w-full p-2 border rounded">
              <option value="">{t('common.all')}</option>
              {/* …ammattilistaus… */}
            </select>
          </div>

          {/* Uskonto & sen tärkeys */}
          <div>
            <label className="block font-medium mb-1">🛐 {t('discover.religion')}</label>
            <select {...register('religion')} className="w-full p-2 border rounded">
              <option value="">{t('common.all')}</option>
              {/* …uskonnot… */}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">{t('discover.religionImportance')}</label>
            <select {...register('religionImportance')} className="w-full p-2 border rounded">
              <option value="">{t('common.all')}</option>
              {/* …tärkeysasteet… */}
            </select>
          </div>

          {/* Lapset & lemmikit */}
          <FormChildrenPets t={t} includeAllOption />

          {/* Elämäntavat */}
          <FormLifestyle t={t} includeAllOption />

          {/* Tavoitteet & Yhteenveto */}
          <FormGoalSummary t={t} includeAllOption />

          {/* Mitä etsit? */}
          <FormLookingFor t={t} includeAllOption />

          {/* Lähetä-nappi */}
          <div className="text-center pt-3">
            <button
              data-cy="DiscoverFilters__submitButton"
              type="submit"
              className="bg-pink-600 text-white font-bold py-2 px-8 rounded-full hover:opacity-90 transition duration-200"
            >
              🔍 {t('common.filter')}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
};

DiscoverFilters.propTypes = {
  values: PropTypes.object.isRequired,
  setters: PropTypes.object.isRequired,
  handleFilter: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default React.memo(DiscoverFilters);
