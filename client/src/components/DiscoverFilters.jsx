// --- REPLACE START: DiscoverFilters wired for backend filters, age inputs, and clean props ---
import PropTypes from "prop-types";
import React from "react";
import { useForm, FormProvider } from "react-hook-form";

// --- REPLACE START: remove unused import FormBasicInfo
// import FormBasicInfo from "./profileFields/FormBasicInfo";
// --- REPLACE END
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormEducation from "./profileFields/FormEducation";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLifestyle from "./profileFields/FormLifestyle";
import FormLocation from "./profileFields/FormLocation";
import FormLookingFor from "./profileFields/FormLookingFor";

/**
 * DiscoverFilters
 * Search and filter component using React Hook Form
 */
const DiscoverFilters = ({
  values,
  // --- REPLACE START: remove unused setters prop
  // setters,
  // --- REPLACE END
  handleFilter,
  t,
}) => {
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
          {/* --- REPLACE START: translate comment */}
          {/* Title and instructions */}
          {/* --- REPLACE END */}
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

          {/* --- REPLACE START: translate comment */}
          {/* Age range: minAge and maxAge */}
          {/* --- REPLACE END */}
          <div className="flex flex-col gap-2">
            <label htmlFor="minAge" className="font-medium">
              {t("discover.ageRange")}
            </label>
            <div className="flex space-x-2">
              <input
                id="minAge"
                type="number"
                {...register("minAge")}
                min={18}
                max={120}
                className="p-2 border rounded w-1/2"
              />
              <input
                id="maxAge"
                type="number"
                {...register("maxAge")}
                min={18}
                max={120}
                className="p-2 border rounded w-1/2"
              />
            </div>
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Username (filter only) */}
          {/* --- REPLACE END */}
          <div>
            <label className="block font-medium mb-1">
              {t("discover.username")}
            </label>
            <input
              type="text"
              {...register("username")}
              className="w-full p-2 border rounded"
            />
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Gender */}
          {/* --- REPLACE END */}
          <div>
            <label className="block font-medium mb-1">
              {t("discover.gender")}
            </label>
            <select
              {...register("gender")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              <option value="Male">{t("profile.male")}</option>
              <option value="Female">{t("profile.female")}</option>
              <option value="Other">{t("profile.other")}</option>
            </select>
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Sexual orientation */}
          {/* --- REPLACE END */}
          <div>
            <label className="block font-medium mb-1">
              ❤️ {t("discover.orientation")}
            </label>
            <select
              {...register("orientation")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              <option value="Straight">{t("profile.straight")}</option>
              <option value="Gay">{t("profile.gay")}</option>
              <option value="Bi">{t("profile.bi")}</option>
              <option value="Other">{t("profile.other")}</option>
            </select>
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Location (country/region/city + custom) */}
          {/* --- REPLACE END */}
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

          {/* --- REPLACE START: translate comment */}
          {/* Education */}
          {/* --- REPLACE END */}
          <FormEducation t={t} includeAllOption />

          {/* --- REPLACE START: translate comment */}
          {/* Profession */}
          {/* --- REPLACE END */}
          <div>
            <label className="block font-medium mb-1">
              {t("discover.profession")}
            </label>
            <select
              {...register("profession")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              {/* …profession list… */}
            </select>
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Religion & importance */}
          {/* --- REPLACE END */}
          <div>
            <label className="block font-medium mb-1">
              🛐 {t("discover.religion")}
            </label>
            <select
              {...register("religion")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              {/* …religion options… */}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">
              {t("discover.religionImportance")}
            </label>
            <select
              {...register("religionImportance")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              {/* …importance levels… */}
            </select>
          </div>

          {/* --- REPLACE START: translate comment */}
          {/* Children & pets */}
          {/* --- REPLACE END */}
          <FormChildrenPets t={t} includeAllOption />

          {/* --- REPLACE START: translate comment */}
          {/* Lifestyle (smoke/drink/drugs, etc.) */}
          {/* --- REPLACE END */}
          <FormLifestyle t={t} includeAllOption />

          {/* --- REPLACE START: translate comment */}
          {/* Goals & summary */}
          {/* --- REPLACE END */}
          <FormGoalSummary t={t} includeAllOption />

          {/* --- REPLACE START: translate comment */}
          {/* What are you looking for? */}
          {/* --- REPLACE END */}
          <FormLookingFor t={t} includeAllOption />

          {/* --- REPLACE START: translate comment */}
          {/* Submit button */}
          {/* --- REPLACE END */}
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

DiscoverFilters.propTypes = {
  values: PropTypes.object.isRequired,
  // --- REPLACE START: remove unused setters propType
  // setters: PropTypes.object.isRequired,
  // --- REPLACE END
  handleFilter: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default React.memo(DiscoverFilters);
// --- REPLACE END ---
