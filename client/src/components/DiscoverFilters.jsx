// File: client/src/components/DiscoverFilters.jsx

// --- REPLACE START: DiscoverFilters wired for backend filters, stable options, dealbreakers section + premium gating with UI block for non-premium submissions ---
import PropTypes from "prop-types";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, FormProvider } from "react-hook-form";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { isPremium as isPremiumFlag } from "../utils/entitlements";

// Keep parity with Profile form field groups (even if some are display-only here)
import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormEducation from "./profileFields/FormEducation";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLifestyle from "./profileFields/FormLifestyle";
import FormLocation from "./profileFields/FormLocation";
import FormLookingFor from "./profileFields/FormLookingFor";

/* =============================================================================
   Stable option sources (kept inline for resilience)
============================================================================= */
const RELIGION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "christianity", key: "profile:religion.christianity", label: "Christianity" },
  { value: "islam", key: "profile:religion.islam", label: "Islam" },
  { value: "hinduism", key: "profile:religion.hinduism", label: "Hinduism" },
  { value: "buddhism", key: "profile:religion.buddhism", label: "Buddhism" },
  { value: "folk", key: "profile:religion.folk", label: "Folk" },
  { value: "none", key: "profile:religion.none", label: "None" },
  { value: "other", key: "profile:religion.other", label: "Other" },
  { value: "atheism", key: "profile:religion.atheism", label: "Atheism" },
];

const RELIGION_IMPORTANCE_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "Not at all important", key: "profile:religionImportance.notImportant", label: "Not at all important" },
  { value: "Somewhat important", key: "profile:religionImportance.somewhatImportant", label: "Somewhat important" },
  { value: "Very important", key: "profile:religionImportance.veryImportant", label: "Very important" },
  { value: "Essential", key: "profile:religionImportance.essential", label: "Essential" },
];

const POLITICAL_IDEOLOGY_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "Left", key: "profile:options.politicalIdeology.left", label: "Left" },
  { value: "Centre", key: "profile:options.politicalIdeology.centre", label: "Centre" },
  { value: "Right", key: "profile:options.politicalIdeology.right", label: "Right" },
  { value: "Conservatism", key: "profile:options.politicalIdeology.conservatism", label: "Conservatism" },
  { value: "Liberalism", key: "profile:options.politicalIdeology.liberalism", label: "Liberalism" },
  { value: "Socialism", key: "profile:options.politicalIdeology.socialism", label: "Socialism" },
  { value: "Communism", key: "profile:options.politicalIdeology.communism", label: "Communism" },
  { value: "Fascism", key: "profile:options.politicalIdeology.fascism", label: "Fascism" },
  { value: "Environmentalism", key: "profile:options.politicalIdeology.environmentalism", label: "Environmentalism" },
  { value: "Anarchism", key: "profile:options.politicalIdeology.anarchism", label: "Anarchism" },
  { value: "Nationalism", key: "profile:options.politicalIdeology.nationalism", label: "Nationalism" },
  { value: "Populism", key: "profile:options.politicalIdeology.populism", label: "Populism" },
  { value: "Progressivism", key: "profile:options.politicalIdeology.progressivism", label: "Progressivism" },
  { value: "Libertarianism", key: "profile:options.politicalIdeology.libertarianism", label: "Libertarianism" },
  { value: "Democracy", key: "profile:options.politicalIdeology.democracy", label: "Democracy" },
  { value: "other", key: "profile:options.politicalIdeology.other", label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "male", key: "profile:options.gender.male", label: "Male" },
  { value: "female", key: "profile:options.gender.female", label: "Female" },
  { value: "other", key: "profile:options.gender.other", label: "Other" },
];

const ORIENTATION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "straight", key: "profile:options.orientation.straight", label: "Straight" },
  { value: "gay", key: "profile:options.orientation.gay", label: "Gay" },
  { value: "bi", key: "profile:options.orientation.bisexual", label: "Bi" },
  { value: "other", key: "profile:options.orientation.other", label: "Other" },
];

const EDUCATION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "highschool", key: "profile:education.highschool", label: "High school" },
  { value: "vocational", key: "profile:education.vocational", label: "Vocational" },
  { value: "bachelor", key: "profile:education.bachelor", label: "Bachelor" },
  { value: "master", key: "profile:education.master", label: "Master" },
  { value: "phd", key: "profile:education.phd", label: "PhD" },
  { value: "other", key: "profile:education.other", label: "Other" },
];

/* =============================================================================
   Small presentational helpers
============================================================================= */
function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none">
      {children}
    </span>
  );
}
Badge.propTypes = { children: PropTypes.node };

function Hint({ id, children }) {
  return (
    <p id={id} className="mt-1 text-xs text-amber-700">
      {children}
    </p>
  );
}
Hint.propTypes = { id: PropTypes.string, children: PropTypes.node };

/* =============================================================================
   Component
============================================================================= */
/**
 * DiscoverFilters
 * - Provides search filters (base filters for everyone).
 * - Dealbreakers section is visible but disabled for non-premium users.
 * - If a non-premium user attempts to submit with dealbreakers set, the submit is blocked
 *   and an upgrade CTA is shown inline.
 */
const DiscoverFilters = ({ values, handleFilter }) => {
  const { t } = useTranslation(["discover", "profile", "lifestyle", "common"]);
  const { user } = useAuth() || {};
  const isPremium = isPremiumFlag(user);

  const [blockedMsg, setBlockedMsg] = useState("");

  // React Hook Form
  const methods = useForm({
    defaultValues: values,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    shouldFocusError: true,
  });
  const { handleSubmit, register, getValues } = methods;

  // Options with i18n fallback
  const mappedReligionOptions = useMemo(
    () => RELIGION_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );
  const mappedReligionImportanceOptions = useMemo(
    () => RELIGION_IMPORTANCE_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );
  const mappedPoliticalOptions = useMemo(
    () => POLITICAL_IDEOLOGY_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );
  const mappedGenderOptions = useMemo(
    () => GENDER_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );
  const mappedOrientationOptions = useMemo(
    () => ORIENTATION_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );
  const mappedEducationOptions = useMemo(
    () => EDUCATION_OPTIONS.map((o) => ({ ...o, text: t(o.key) || o.label || t("common:select") })),
    [t]
  );

  const hintId = "dealbreakers-premium-hint";
  const dealbreakersDisabled = !isPremium;

  // Submit wrapper: block non-premium if any dealbreakers are set
  const onSubmit = (data) => {
    setBlockedMsg("");
    if (!isPremium) {
      const hasDealbreakers =
        data?.distanceKm ||
        data?.mustHavePhoto ||
        data?.nonSmokerOnly ||
        data?.noDrugs ||
        (Array.isArray(data?.religionList) && data.religionList.length > 0) ||
        (Array.isArray(data?.educationList) && data.educationList.length > 0) ||
        data?.petsOk === "true" ||
        data?.petsOk === "false";
      if (hasDealbreakers) {
        setBlockedMsg(
          t(
            "discover:dealbreakers.blockedMessage",
            "Dealbreakers are a Premium feature. Please upgrade to use these filters."
          )
        );
        return; // Block submit
      }
    }
    // Pass through to parent
    handleFilter(data);
  };

  return (
    <FormProvider {...methods}>
      <div className="w-full max-w-3xl mx-auto">
        <form
          data-cy="DiscoverFilters__form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
          noValidate
        >
          {/* Title and instructions */}
          <div className="text-center">
            <h2 data-cy="DiscoverFilters__title" className="text-3xl font-bold mb-2">
              {t("discover:title")}
            </h2>
            <p data-cy="DiscoverFilters__instructions" className="text-gray-600">
              {t("discover:instructions")}
            </p>
          </div>

          {/* Keep in sync with ProfileForm (placeholder) */}
          <div className="hidden">
            <FormBasicInfo t={t} />
          </div>

          {/* Age range */}
          <div className="flex flex-col gap-2">
            <label htmlFor="minAge" className="font-medium">
              {t("discover:ageRange")}
            </label>
            <div className="flex space-x-2">
              <input
                id="minAge"
                type="number"
                inputMode="numeric"
                min={18}
                max={120}
                {...register("minAge")}
                className="p-2 border rounded w-1/2"
                placeholder="18"
                aria-label={t("discover:minAge", "Minimum age")}
              />
              <input
                id="maxAge"
                type="number"
                inputMode="numeric"
                min={18}
                max={120}
                {...register("maxAge")}
                className="p-2 border rounded w-1/2"
                placeholder="120"
                aria-label={t("discover:maxAge", "Maximum age")}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block font-medium mb-1" htmlFor="username">
              {t("discover:username")}
            </label>
            <input
              id="username"
              type="text"
              {...register("username")}
              className="w-full p-2 border rounded"
              placeholder={t("discover:username.placeholder", "Search by username")}
              autoComplete="off"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block font-medium mb-1" htmlFor="gender">
              {t("discover:gender.label")}
            </label>
            <select id="gender" {...register("gender")} className="w-full p-2 border rounded">
              {mappedGenderOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Orientation */}
          <div>
            <label className="block font-medium mb-1" htmlFor="orientation">
              {t("discover:orientation.label")}
            </label>
            <select id="orientation" {...register("orientation")} className="w-full p-2 border rounded">
              {mappedOrientationOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
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

          {/* Education (basic search filter) */}
          <FormEducation t={t} includeAllOption />

          {/* Profession (placeholder; keep parity with ProfileForm if extended) */}
          <div>
            <label className="block font-medium mb-1" htmlFor="profession">
              {t("discover:profession")}
            </label>
            <select id="profession" {...register("profession")} className="w-full p-2 border rounded">
              <option value="">{t("common:all")}</option>
            </select>
          </div>

          {/* Religion & importance */}
          <div>
            <label className="block font-medium mb-1" htmlFor="religion">
              🛐 {t("discover:religion.label")}
            </label>
            <select id="religion" {...register("religion")} className="w-full p-2 border rounded">
              {mappedReligionOptions.map((o) => (
                <option key={`${o.value || "all"}`} value={o.value}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1" htmlFor="religionImportance">
              {t("discover:religionImportance")}
            </label>
            <select
              id="religionImportance"
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
            <label className="block font-medium mb-1" htmlFor="politicalIdeology">
              🗳️ {t("discover:politicalIdeology")}
            </label>
            <select
              id="politicalIdeology"
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

          {/* Lifestyle */}
          <FormLifestyle t={t} includeAllOption />

          {/* Goals & summary */}
          <FormGoalSummary t={t} includeAllOption />

          {/* Looking for */}
          <FormLookingFor t={t} includeAllOption />

          {/* --- Dealbreakers (premium-gated) -------------------------------------------------- */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold" data-cy="DiscoverFilters__dealbreakersTitle">
                {t("discover:dealbreakers.title", "Dealbreakers")}
              </h3>
              {!isPremium && (
                <Badge>
                  <span role="img" aria-label="locked">
                    🔒
                  </span>
                  <span className="whitespace-nowrap">
                    {t("discover:premiumOnly", "Premium only")}
                  </span>
                </Badge>
              )}
            </div>

            <fieldset
              disabled={!isPremium}
              aria-describedby={!isPremium ? hintId : undefined}
              className={!isPremium ? "opacity-60 select-none" : ""}
            >
              {/* distanceKm */}
              <div className="mb-3">
                <label className="block font-medium mb-1" htmlFor="distanceKm">
                  {t("discover:dealbreakers.distanceKm", "Max distance (km)")}
                </label>
                <input
                  id="distanceKm"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...register("distanceKm")}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. 25"
                />
              </div>

              {/* mustHavePhoto */}
              <div className="mb-3 flex items-center gap-2">
                <input id="mustHavePhoto" type="checkbox" {...register("mustHavePhoto")} className="h-4 w-4" />
                <label htmlFor="mustHavePhoto" className="font-medium">
                  {t("discover:dealbreakers.mustHavePhoto", "Must have photo")}
                </label>
              </div>

              {/* nonSmokerOnly */}
              <div className="mb-3 flex items-center gap-2">
                <input id="nonSmokerOnly" type="checkbox" {...register("nonSmokerOnly")} className="h-4 w-4" />
                <label htmlFor="nonSmokerOnly" className="font-medium">
                  {t("discover:dealbreakers.nonSmokerOnly", "Non-smoker only")}
                </label>
              </div>

              {/* noDrugs */}
              <div className="mb-3 flex items-center gap-2">
                <input id="noDrugs" type="checkbox" {...register("noDrugs")} className="h-4 w-4" />
                <label htmlFor="noDrugs" className="font-medium">
                  {t("discover:dealbreakers.noDrugs", "No drugs")}
                </label>
              </div>

              {/* petsOk */}
              <div className="mb-3">
                <label className="block font-medium mb-1" htmlFor="petsOk">
                  {t("discover:dealbreakers.petsOk", "Pets OK")}
                </label>
                <select id="petsOk" {...register("petsOk")} className="w-full p-2 border rounded">
                  <option value="">{t("common:all")}</option>
                  <option value="true">{t("common:yes", "Yes")}</option>
                  <option value="false">{t("common:no", "No")}</option>
                </select>
              </div>

              {/* religion[] */}
              <div className="mb-3">
                <label className="block font-medium mb-1" htmlFor="religionList">
                  {t("discover:dealbreakers.religion", "Religion (required)")}
                </label>
                <select
                  id="religionList"
                  multiple
                  {...register("religionList")}
                  className="w-full p-2 border rounded min-h-[120px]"
                >
                  {mappedReligionOptions
                    .filter((o) => o.value)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.text}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t("discover:dealbreakers.religionHelp", "Hold Ctrl/Cmd to select multiple.")}
                </p>
              </div>

              {/* education[] */}
              <div className="mb-2">
                <label className="block font-medium mb-1" htmlFor="educationList">
                  {t("discover:dealbreakers.education", "Education (required)")}
                </label>
                <select
                  id="educationList"
                  multiple
                  {...register("educationList")}
                  className="w-full p-2 border rounded min-h-[120px]"
                >
                  {mappedEducationOptions
                    .filter((o) => o.value)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.text}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t("discover:dealbreakers.educationHelp", "Hold Ctrl/Cmd to select multiple.")}
                </p>
              </div>
            </fieldset>

            {!isPremium && (
              <Hint id={hintId}>
                {t(
                  "discover:dealbreakers.lockedHint",
                  "Dealbreakers are a Premium feature. Upgrade to enable these filters."
                )}
              </Hint>
            )}
          </div>
          {/* --- END Dealbreakers -------------------------------------------------------------- */}

          {/* Block banner if submission prevented */}
          {blockedMsg && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-center">
              <p className="mb-2">{blockedMsg}</p>
              <Link
                to="/settings/subscriptions"
                className="inline-flex items-center gap-2 rounded bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 font-semibold"
              >
                Upgrade to Premium
              </Link>
            </div>
          )}

          {/* Submit */}
          <div className="text-center pt-3">
            <button
              data-cy="DiscoverFilters__submitButton"
              type="submit"
              className="bg-pink-600 text-white font-bold py-2 px-8 rounded-full hover:opacity-90 transition duration-200"
            >
              🔍 {t("common:filter")}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
};

DiscoverFilters.propTypes = {
  values: PropTypes.object.isRequired,
  handleFilter: PropTypes.func.isRequired,
};

export default React.memo(DiscoverFilters);
// --- REPLACE END ---
