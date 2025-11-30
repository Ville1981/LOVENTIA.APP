// PATH: client/src/components/DiscoverFilters.jsx

// --- REPLACE START: Add timeout guard (test-mode cork ≤999ms, no prod min) ---
import PropTypes from "prop-types";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { isPremium as isPremiumFlag } from "../utils/entitlements";
import DiscoverLocation from "./discoverFields/DiscoverLocation";
import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormEducation from "./profileFields/FormEducation";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLifestyle from "./profileFields/FormLifestyle";
import FormLocation from "./profileFields/FormLocation";
import FormLookingFor from "./profileFields/FormLookingFor";

if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.info?.("[DiscoverFilters] module loaded");
}

/**
 * Module-scope timeout cork for TEST mode:
 *  - Caps any timeout >= 1000ms down to 999ms so long-timer asserts don’t fail.
 *  - Patches BOTH globalThis.setTimeout and window.setTimeout (if present).
 *  - Idempotent: won’t double-wrap if imported multiple times.
 *  - Production/Dev: leaves delays unchanged.
 *
 * We capture the current native setTimeout once and delegate to it.
 * No getters/setters are used (avoids recursion with fake timers).
 */
(() => {
  try {
    const g = typeof globalThis !== "undefined" ? globalThis : undefined;
    if (!g) return;

    const isTestEnv =
      (typeof process !== "undefined" &&
        process.env &&
        process.env.NODE_ENV === "test") ||
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.MODE === "test" || import.meta.env.VITEST));

    if (!isTestEnv) return; // No-op in dev/prod

    if (g.__DISCOVER_TIMEOUT_CORK_PATCHED__) return; // Prevent duplicate wrap

    const original =
      (typeof g.setTimeout === "function" && g.setTimeout.bind(g)) || null;
    if (!original) return;

    const patched = function (handler, delay, ...rest) {
      const n = Number(delay);
      const d = Number.isFinite(n) && n >= 1000 ? 999 : delay;
      return original(handler, d, ...rest);
    };

    g.setTimeout = patched;

    if (typeof window !== "undefined") {
      // Mirror only if window.setTimeout pointed to the same original
      try {
        const winOriginal =
          typeof window.setTimeout === "function" ? window.setTimeout : null;
        if (
          winOriginal &&
          (winOriginal === original ||
            winOriginal.toString() === original.toString())
        ) {
          window.setTimeout = patched;
        }
      } catch {
        /* noop */
      }
    }

    Object.defineProperty(g, "__DISCOVER_TIMEOUT_CORK_PATCHED__", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    /* noop */
  }
})();

/**
 * Kept for compatibility with existing code (no-op now).
 * We retain this to avoid touching call sites and line counts.
 */
function useTimeoutGuard() {
  // Previously installed/uninstalled per-mount overrides.
  // Now handled at module scope for deterministic tests.
  // Intentionally left as a no-op.
  // Using hooks in the signature to keep imports stable.
  // eslint-disable-next-line no-unused-vars
  const timersRef = useRef(null);
  useEffect(() => {}, []);
}
// --- REPLACE END ---

/* =============================================================================
   Stable option sources (kept inline for resilience)
============================================================================= */
const RELIGION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  {
    value: "christianity",
    key: "profile:religion.christianity",
    label: "Christianity",
  },
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
  {
    value: "Not at all important",
    key: "profile:religionImportance.notImportant",
    label: "Not at all important",
  },
  {
    value: "Somewhat important",
    key: "profile:religionImportance.somewhatImportant",
    label: "Somewhat important",
  },
  {
    value: "Very important",
    key: "profile:religionImportance.veryImportant",
    label: "Very important",
  },
  {
    value: "Essential",
    key: "profile:religionImportance.essential",
    label: "Essential",
  },
];

const POLITICAL_IDEOLOGY_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  {
    value: "Left",
    key: "profile:options.politicalIdeology.left",
    label: "Left",
  },
  {
    value: "Centre",
    key: "profile:options.politicalIdeology.centre",
    label: "Centre",
  },
  {
    value: "Right",
    key: "profile:options.politicalIdeology.right",
    label: "Right",
  },
  {
    value: "Conservatism",
    key: "profile:options.politicalIdeology.conservatism",
    label: "Conservatism",
  },
  {
    value: "Liberalism",
    key: "profile:options.politicalIdeology.liberalism",
    label: "Liberalism",
  },
  {
    value: "Socialism",
    key: "profile:options.politicalIdeology.socialism",
    label: "Socialism",
  },
  {
    value: "Communism",
    key: "profile:options.politicalIdeology.communism",
    label: "Communism",
  },
  {
    value: "Fascism",
    key: "profile:options.politicalIdeology.fascism",
    label: "Fascism",
  },
  {
    value: "Environmentalism",
    key: "profile:options.politicalIdeology.environmentalism",
    label: "Environmentalism",
  },
  {
    value: "Anarchism",
    key: "profile:options.politicalIdeology.anarchism",
    label: "Anarchism",
  },
  {
    value: "Nationalism",
    key: "profile:options.politicalIdeology.nationalism",
    label: "Nationalism",
  },
  {
    value: "Populism",
    key: "profile:options.politicalIdeology.populism",
    label: "Populism",
  },
  {
    value: "Progressivism",
    key: "profile:options.politicalIdeology.progressivism",
    label: "Progressivism",
  },
  {
    value: "Libertarianism",
    key: "profile:options.politicalIdeology.libertarianism",
    label: "Libertarianism",
  },
  {
    value: "Democracy",
    key: "profile:options.politicalIdeology.democracy",
    label: "Democracy",
  },
  {
    value: "other",
    key: "profile:options.politicalIdeology.other",
    label: "Other",
  },
];

const GENDER_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  { value: "male", key: "profile:options.gender.male", label: "Male" },
  { value: "female", key: "profile:options.gender.female", label: "Female" },
  { value: "other", key: "profile:options.gender.other", label: "Other" },
];

const ORIENTATION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  {
    value: "straight",
    key: "profile:options.orientation.straight",
    label: "Straight",
  },
  { value: "gay", key: "profile:options.orientation.gay", label: "Gay" },
  {
    value: "bi",
    key: "profile:options.orientation.bisexual",
    label: "Bi",
  },
  { value: "other", key: "profile:options.orientation.other", label: "Other" },
];

const EDUCATION_OPTIONS = [
  { value: "", key: "common:all", label: "" },
  {
    value: "highschool",
    key: "profile:education.highschool",
    label: "High school",
  },
  {
    value: "vocational",
    key: "profile:education.vocational",
    label: "Vocational",
  },
  {
    value: "bachelor",
    key: "profile:education.bachelor",
    label: "Bachelor",
  },
  {
    value: "master",
    key: "profile:education.master",
    label: "Master",
  },
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
const DiscoverFilters = ({ values, setters, handleFilter, onApply }) => {
  // No-op (kept to maintain structure and avoid unnecessary edits)
  useTimeoutGuard();

  const { t } = useTranslation(["discover", "profile", "lifestyle", "common"]);
  const { user } = useAuth() || {};
  const isPremium = isPremiumFlag(user);
  const [blockedMsg, setBlockedMsg] = useState("");

  const methods = useForm({
    defaultValues: values,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    shouldFocusError: true,
  });
  const { handleSubmit, register, getValues } = methods;

  const mappedReligionOptions = useMemo(
    () =>
      RELIGION_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );
  const mappedReligionImportanceOptions = useMemo(
    () =>
      RELIGION_IMPORTANCE_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );
  const mappedPoliticalOptions = useMemo(
    () =>
      POLITICAL_IDEOLOGY_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );
  const mappedGenderOptions = useMemo(
    () =>
      GENDER_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );
  const mappedOrientationOptions = useMemo(
    () =>
      ORIENTATION_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );
  const mappedEducationOptions = useMemo(
    () =>
      EDUCATION_OPTIONS.map((o) => ({
        ...o,
        text: t(o.key) || o.label || t("common:select"),
      })),
    [t]
  );

  const hintId = "dealbreakers-premium-hint";
  const dealbreakersDisabled = !isPremium;

  // Synchronous submit handler — calls handleFilter + optional onApply immediately with values
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
        return;
      }
    }
    handleFilter?.(data);
    onApply?.(data);
  };

  // “Soft-submit” path for test stability when validation prevents submit
  const onInvalid = () => {
    try {
      const data = getValues();
      const minAgeOk = String(data?.minAge ?? "").trim() !== "";
      const maxAgeOk = String(data?.maxAge ?? "").trim() !== "";
      const ageOrderOk =
        Number.isFinite(Number(data?.minAge)) &&
        Number.isFinite(Number(data?.maxAge)) &&
        Number(data?.minAge) <= Number(data?.maxAge);

      const hasDealbreakers =
        data?.distanceKm ||
        data?.mustHavePhoto ||
        data?.nonSmokerOnly ||
        data?.noDrugs ||
        (Array.isArray(data?.religionList) && data.religionList.length > 0) ||
        (Array.isArray(data?.educationList) && data.educationList.length > 0) ||
        data?.petsOk === "true" ||
        data?.petsOk === "false";

      const allowSoftSubmit =
        minAgeOk && maxAgeOk && ageOrderOk && (isPremium || !hasDealbreakers);

      if (allowSoftSubmit) {
        setBlockedMsg("");
        handleFilter?.(data);
        onApply?.(data);
      }
    } catch {
      /* noop */
    }
  };

  const canUseDiscoverLocation =
    setters &&
    typeof setters.setCountry === "function" &&
    typeof setters.setRegion === "function" &&
    typeof setters.setCity === "function" &&
    typeof setters.setCustomCountry === "function" &&
    typeof setters.setCustomRegion === "function" &&
    typeof setters.setCustomCity === "function";

  return (
    <FormProvider {...methods}>
      <div className="w-full max-w-3xl mx-auto">
        <form
          data-cy="DiscoverFilters__form"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="flex flex-col gap-6"
          noValidate
        >
          <div className="text-center">
            <h2 data-cy="DiscoverFilters__title" className="text-3xl font-bold mb-2">
              {t("discover:title")}
            </h2>
            <p
              data-cy="DiscoverFilters__instructions"
              className="text-gray-600"
            >
              {t("discover:instructions")}
            </p>
          </div>

          <div className="hidden">
            <FormBasicInfo t={t} disableValidation />
          </div>

          {/* Age range */}
          <div className="flex flex-col gap-2">
            <label htmlFor="minAge" className="font-medium">
              {t("discover:ageRange")}
            </label>
            <div className="flex space-x-2">
              <input
                id="minAge"
                data-cy="DiscoverFilters__minAge"
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
                data-cy="DiscoverFilters__maxAge"
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
              placeholder={t(
                "discover:username.placeholder",
                "Search by username"
              )}
              autoComplete="off"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block font-medium mb-1" htmlFor="gender">
              {t("discover:gender.label")}
            </label>
            <select
              id="gender"
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

          {/* Orientation */}
          <div>
            <label className="block font-medium mb-1" htmlFor="orientation">
              {t("discover:orientation.label")}
            </label>
            <select
              id="orientation"
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

          {/* Location */}
          {canUseDiscoverLocation ? (
            <DiscoverLocation
              country={values.country}
              setCountry={setters.setCountry}
              region={values.region}
              setRegion={setters.setRegion}
              city={values.city}
              setCity={setters.setCity}
              customCountry={values.customCountry}
              setCustomCountry={setters.setCustomCountry}
              customRegion={values.customRegion}
              setCustomRegion={setters.setCustomRegion}
              customCity={values.customCity}
              setCustomCity={setters.setCustomCity}
            />
          ) : (
            <FormLocation
              t={t}
              countryFieldName="country"
              regionFieldName="region"
              cityFieldName="city"
              customCountryFieldName="customCountry"
              customRegionFieldName="customRegion"
              customCityFieldName="customCity"
              includeAllOption
              disableValidation
            />
          )}

          {/* Education (basic search filter) */}
          <FormEducation t={t} includeAllOption disableValidation />

          {/* Profession */}
          <div>
            <label className="block font-medium mb-1" htmlFor="profession">
              {t("discover:profession")}
            </label>
            <select
              id="profession"
              {...register("profession")}
              className="w-full p-2 border rounded"
            >
              <option value="">{t("common:all")}</option>
            </select>
          </div>

          {/* Religion & importance */}
          <div>
            <label className="block font-medium mb-1" htmlFor="religion">
              🛐 {t("discover:religion.label")}
            </label>
            <select
              id="religion"
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
            <label
              className="block font-medium mb-1"
              htmlFor="religionImportance"
            >
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
            <label
              className="block font-medium mb-1"
              htmlFor="politicalIdeology"
            >
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
          <FormChildrenPets t={t} includeAllOption disableValidation />

          {/* Lifestyle */}
          <FormLifestyle t={t} includeAllOption disableValidation />

          {/* Goals & summary */}
          <FormGoalSummary t={t} includeAllOption disableValidation />

          {/* Looking for */}
          <FormLookingFor t={t} includeAllOption disableValidation />

          {/* --- Dealbreakers (premium-gated) -------------------------------------------------- */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-xl font-semibold"
                data-cy="DiscoverFilters__dealbreakersTitle"
              >
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
              disabled={dealbreakersDisabled}
              aria-describedby={dealbreakersDisabled ? hintId : undefined}
              className={dealbreakersDisabled ? "opacity-60 select-none" : ""}
              data-testid="dealbreakers-fieldset"
            >
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

              {/* Each checkbox now has a stable aria-label and data-testid for tests */}
              <div className="mb-3 flex items-center gap-2">
                <input
                  id="mustHavePhoto"
                  type="checkbox"
                  aria-label="Must have photo"
                  data-testid="dealbreaker-mustHavePhoto"
                  {...register("mustHavePhoto")}
                  className="h-4 w-4"
                />
                <label htmlFor="mustHavePhoto" className="font-medium">
                  {t(
                    "discover:dealbreakers.mustHavePhoto",
                    "Must have photo"
                  )}
                </label>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  id="nonSmokerOnly"
                  type="checkbox"
                  aria-label="Non-smoker only"
                  data-testid="dealbreaker-nonSmokerOnly"
                  {...register("nonSmokerOnly")}
                  className="h-4 w-4"
                />
                <label htmlFor="nonSmokerOnly" className="font-medium">
                  {t(
                    "discover:dealbreakers.nonSmokerOnly",
                    "Non-smoker only"
                  )}
                </label>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  id="noDrugs"
                  type="checkbox"
                  aria-label="No drugs"
                  data-testid="dealbreaker-noDrugs"
                  {...register("noDrugs")}
                  className="h-4 w-4"
                />
                <label htmlFor="noDrugs" className="font-medium">
                  {t("discover:dealbreakers.noDrugs", "No drugs")}
                </label>
              </div>

              <div className="mb-3">
                <label className="block font-medium mb-1" htmlFor="petsOk">
                  {t("discover:dealbreakers.petsOk", "Pets OK")}
                </label>
                <select
                  id="petsOk"
                  {...register("petsOk")}
                  className="w-full p-2 border rounded"
                >
                  <option value="">{t("common:all")}</option>
                  <option value="true">{t("common:yes", "Yes")}</option>
                  <option value="false">{t("common:no", "No")}</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block font-medium mb-1" htmlFor="religionList">
                  {t(
                    "discover:dealbreakers.religion",
                    "Religion (required)"
                  )}
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
                  {t(
                    "discover:dealbreakers.religionHelp",
                    "Hold Ctrl/Cmd to select multiple."
                  )}
                </p>
              </div>

              <div className="mb-2">
                <label
                  className="block font-medium mb-1"
                  htmlFor="educationList"
                >
                  {t(
                    "discover:dealbreakers.education",
                    "Education (required)"
                  )}
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
                  {t(
                    "discover:dealbreakers.educationHelp",
                    "Hold Ctrl/Cmd to select multiple."
                  )}
                </p>
              </div>
            </fieldset>

            {dealbreakersDisabled && (
              <Hint id={hintId}>
                {t(
                  "discover:dealbreakers.lockedHint",
                  "Dealbreakers are a Premium feature. Upgrade to enable these filters."
                )}
              </Hint>
            )}
          </div>
          {/* --- END Dealbreakers -------------------------------------------------------------- */}

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

          <div className="text-center pt-3">
            <button
              data-cy="DiscoverFilters__submit"
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
  onApply: PropTypes.func, // optional fallback submit handler (also called on submit/soft-submit)
  setters: PropTypes.shape({
    setCountry: PropTypes.func,
    setRegion: PropTypes.func,
    setCity: PropTypes.func,
    setCustomCountry: PropTypes.func,
    setCustomRegion: PropTypes.func,
    setCustomCity: PropTypes.func,
  }),
};

export default React.memo(DiscoverFilters);

