import React, { memo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormLocation from "./profileFields/FormLocation";
import FormEducation from "./profileFields/FormEducation";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLookingFor from "./profileFields/FormLookingFor";
import FormLifestyle from "./profileFields/FormLifestyle";

/**
 * DiscoverFilters
 * Haku- ja suodatuskomponentti React Hook Formilla
 */
const DiscoverFilters = ({ values, handleFilter, t }) => {
  const methods = useForm({
    defaultValues: values,
    mode: "onSubmit",
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
            <h2
              data-cy="DiscoverFilters__title"
              className="text-3xl font-bold mb-2"
            >
              {t("discover.title")}
            </h2>
            <p
              data-cy="DiscoverFilters__instructions"
              className="text-gray-600"
            >
              {t("discover.instructions")}
            </p>
          </div>

          {/* Ikähaitari */}
          <div className="flex flex-col items-start gap-2">
            <label
              htmlFor="ageRangeSlider"
              data-cy="DiscoverFilters__ageSliderLabel"
              className="font-medium"
            >
              {t("discover.ageRange")}
            </label>
            <input
              id="ageRangeSlider"
              type="range"
              min="18"
              max="99"
              {...register("ageRange")}
              data-cy="DiscoverFilters__ageSlider"
            />
          </div>

          {/* Perustiedot (ilman käyttäjätunnus/sähköposti) */}
          <FormBasicInfo t={t} hideUsernameEmail />

          {/* Sijainti */}
          <FormLocation t={t} />

          {/* Koulutus ym. */}
          <FormEducation t={t} />

          {/* Lapset & lemmikit */}
          <FormChildrenPets t={t} />

          {/* Elämäntavat */}
          <FormLifestyle t={t} />

          {/* Tavoitteet & yhteenveto */}
          <FormGoalSummary t={t} />

          {/* Hakuperusteet */}
          <FormLookingFor t={t} />

          {/* Lähetä nappi */}
          <div className="text-center pt-3">
            <button
              data-cy="DiscoverFilters__submitButton"
              type="submit"
              className="bg-pink-600 text-white font-bold py-2 px-8 rounded-full hover:opacity-90 transition duration-200"
            >
              🔍 {t("common.filter")}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
};

export default memo(DiscoverFilters);
