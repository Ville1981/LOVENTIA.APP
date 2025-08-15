// --- REPLACE START: DiscoverFilters wired for backend filters, stable options, and identical lists with ProfileForm ---
import PropTypes from "prop-types";
import React, { useMemo } from "react";
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
 * Stable option sources (kept in-code so dropdowns never "disappear" if a translation key is missing).
 * Labels are shown via t(key) || fallbackLabel, so missing keys won't blank the option.
 * These match ProfileForm exactly, including Democracy and Left/Centre/Right.
 */

// Religion options (match ProfileForm)
const RELIGION_OPTIONS = [
  { value: "", key: "common.all", label: "" },
  { value: "Christianity", key: "religion.christianity", label: "Christianity" },
  { value: "Islam", key: "religion.islam", label: "Islam" },
  { value: "Hinduism", key: "religion.hinduism", label: "Hinduism" },
  { value: "Buddhism", key: "religion.buddhism", label: "Buddhism" },
  { value: "Folk", key: "religion.folk", label: "Folk" },
  { value: "None", key: "religion.none", label: "None" },
  { value: "Other", key: "religion.other", label: "Other" },
  { value: "Atheism", key: "religion.atheism", label: "Atheism" },
];

// Religion importance options (match ProfileForm)
const RELIGION_IMPORTANCE_OPTIONS = [
  { value: "", key: "common.all", label: "" },
  { value: "Not at all important", key: "profile.notImportant", label: "Not at all important" },
  { value: "Somewhat important", key: "profile.somewhatImportant", label: "Somewhat important" },
  { value: "Very important", key: "profile.veryImportant", label: "Very important" },
  { value: "Essential", key: "profile.essential", label: "Essential" },
];

// Political ideology options (match ProfileForm with Left / Centre / Right and Democracy)
const POLITICAL_IDEOLOGY_OPTIONS = [
  { value: "", key: "common.all", label: "" },
  { value: "Left", key: "politics.left", label: "Left" },
  { value: "Centre", key: "politics.centre", label: "Centre" },
  { value: "Right", key: "politics.right", label: "Right" },
  { value: "Conservatism", key: "politics.conservatism", label: "Conservatism" },
  { value: "Liberalism", key: "politics.liberalism", label: "Liberalism" },
  { value: "Socialism", key: "politics.socialism", label: "Socialism" },
  { value: "Communism", key: "politics.communism", label: "Communism" },
  { value: "Fascism", key: "politics.fascism", label: "Fascism" },
  { value: "Environmentalism", key: "politics.environmentalism", label: "Environmentalism" },
  { value: "Anarchism", key: "politics.anarchism", label: "Anarchism" },
  { value: "Nationalism", key: "politics.nationalism", label: "Nationalism" },
  { value: "Populism", key: "politics.populism", label: "Populism" },
  { value: "Progressivism", key: "politics.progressivism", label: "Progressivism" },
  { value: "Libertarianism", key: "politics.libertarianism", label: "Libertarianism" },
  { value: "Democracy", key: "politics.democracy", label: "Democracy" },
  { value: "Other", key: "politics.other", label: "Other" },
];

// Gender options (parity with ProfileForm)
const GENDER_OPTIONS = [
  { value: "", key: "common.all", label: "" },
  { value: "Male", key: "profile.male", label: "Male" },
  { value: "Female", key: "profile.female", label: "Female" },
  { value: "Other", key: "profile.other", label: "Other" },
];

// Orientation options (parity with ProfileForm)
const ORIENTATION_OPTIONS = [
  { value: "", key: "common.all", label: "" },
  { value: "Straight", key: "profile.straight", label: "Straight" },
  { value: "Gay", key: "profile.gay", label: "Gay" },
  { value: "Bi", key: "profile.bi", label: "Bi" },
  { value: "Other", key: "profile.other", label: "Other" },
];

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

  // Memoized mapped options
  const mappedReligionOptions = useMemo(
    () =>
      RELIGION_OPTIONS.map((opt) => ({
        ...opt,
        text: t(opt.key) || opt.label || t("common.select"),
      })),
    [t]
  );

  const mappedReligionImportanceOptions = useMemo(
    () =>
      RELIGION_IMPORTANCE_OPTIONS.map((opt) => ({
        ...opt,
        text: t(opt.key) || opt.label || t("common.select"),
      })),
    [t]
  );

  const mappedPoliticalOptions = useMemo(
    () =>
      POLITICAL_IDEOLOGY_OPTIONS.map((opt) => ({
        ...opt,
        text: t(opt.key) || opt.label || t("common.select"),
      })),
    [t]
  );

  const mappedGenderOptions = useMemo(
    () =>
      GENDER_OPTIONS.map((opt) => ({
        ...opt,
        text: t(opt.key) || opt.label || t("common.select"),
      })),
    [t]
  );

  const mappedOrientationOptions = useMemo(
    () =>
      ORIENTATION_OPTIONS.map((opt) => ({
        ...opt,
        text: t(opt.key) || opt.label || t("common.select"),
      })),
    [t]
  );

  return (
    <FormProvider {...methods}>
      <div className="w-full max-w-3xl mx-auto">
        <form
          data-cy="DiscoverFilters__form"
          onSubmit={handleSubmit(handleFilter)}
          className="flex flex-col gap-6"
        >
          {/* Title and instructions */}
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

          {/* Age range: minAge and maxAge */}
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

          {/* Username (filter only) */}
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

          {/* Gender */}
          <div>
            <label className="block font-medium mb-1">
              {t("discover.gender")}
            </label>
            <select
              {...register("gender")}
              className="w-full p-2 border rounded"
            >
              {mappedGenderOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Sexual orientation */}
          <div>
            <label className="block font-medium mb-1">
              ❤️ {t("discover.orientation")}
            </label>
            <select
              {...register("orientation")}
              className="w-full p-2 border rounded"
            >
              {mappedOrientationOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Location (country/region/city + custom) */}
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

          {/* Education */}
          <FormEducation t={t} includeAllOption />

          {/* Profession (placeholder select; mirror ProfileForm list when finalized) */}
          <div>
            <label className="block font-medium mb-1">
              {t("discover.profession")}
            </label>
            <select
              {...register("profession")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common.all")}</option>
              {/* Keep in sync with ProfileForm categories if you expose them here */}
            </select>
          </div>

          {/* Religion & importance */}
          <div>
            <label className="block font-medium mb-1">
              🛐 {t("discover.religion")}
            </label>
            <select
              {...register("religion")}
              className="w-full p-2 border rounded"
            >
              {mappedReligionOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
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
              {mappedReligionImportanceOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Political ideology */}
          <div>
            <label className="block font-medium mb-1">
              🗳️ {t("discover.politicalIdeology")}
            </label>
            <select
              {...register("politicalIdeology")}
              className="w-full p-2 border rounded"
            >
              {mappedPoliticalOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Children & pets */}
          <FormChildrenPets t={t} includeAllOption />

          {/* Lifestyle (smoke/drink/drugs, etc.) */}
          <FormLifestyle t={t} includeAllOption />

          {/* Goals & summary */}
          <FormGoalSummary t={t} includeAllOption />

          {/* What are you looking for? */}
          <FormLookingFor t={t} includeAllOption />

          {/* Submit button */}
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
