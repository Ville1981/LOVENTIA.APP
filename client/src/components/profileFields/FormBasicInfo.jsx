// --- REPLACE START: add search-mode validation gating; keep structure & behavior intact ---
import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormBasicInfo
 * Form section: user's basic info.
 * Uses RHF-context for register & error display.
 *
 * Props:
 *   t: translation function (required)
 *   hideUsernameEmail: hide username & email (default: false)
 *   disableValidation / mode="search": when active, do NOT register RHF required rules,
 *     do NOT add DOM `required` attributes, and avoid forced defaults that would
 *     make fields effectively mandatory in search mode.
 */
const FormBasicInfo = ({
  t,
  hideUsernameEmail = false,
  disableValidation = false,
  mode = undefined,
}) => {
  // Search mode toggle (true when validation must be suppressed)
  const searchMode = !!disableValidation || mode === "search";

  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Helper to conditionally pass rules to RHF (future-proof if rules are added later)
  const withRules = (rules) => (searchMode ? {} : rules || {});

  // Age options: 18–99
  const ageOptions = Array.from({ length: 82 }, (_, i) => i + 18);

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormBasicInfo__section">
      {/* Username & Email */}
      {!hideUsernameEmail && (
        <>
          <div>
            <input
              type="text"
              placeholder={t("profile:username")}
              {...register("username", withRules(/* e.g., { required: t('common:required') } */))}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__usernameInput"
              required={false}
              autoComplete="off"
            />
            {errors.username && (
              <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__usernameError">
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <input
              type="email"
              placeholder={t("profile:email")}
              {...register("email", withRules(/* e.g., { required: t('common:required') } */))}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__emailInput"
              required={false}
              autoComplete="off"
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__emailError">
                {errors.email.message}
              </p>
            )}
          </div>
        </>
      )}

      {/* Age */}
      <div className="w-full">
        <label
          htmlFor="ageSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__ageLabel"
        >
          {t("profile:age")}
        </label>
        <select
          id="ageSelect"
          {...register("age", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__ageSelect"
          required={false}
        >
          <option value="">{t("common:select")}</option>
          {ageOptions.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
        {errors.age && (
          <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__ageError">
            {errors.age.message}
          </p>
        )}
      </div>

      {/* Gender */}
      <div className="w-full">
        <label
          htmlFor="genderSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__genderLabel"
        >
          {t("profile:gender.label")}
        </label>
        <select
          id="genderSelect"
          {...register("gender", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__genderSelect"
          required={false}
        >
          <option value="">{t("common:select")}</option>
          {/* Use options namespace to match JSON */}
          <option value="male">{t("options:gender.male")}</option>
          <option value="female">{t("options:gender.female")}</option>
          <option value="other">{t("options:gender.other")}</option>
        </select>
        {errors.gender && (
          <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__genderError">
            {errors.gender.message}
          </p>
        )}
      </div>

      {/* Orientation */}
      <div className="w-full">
        <label
          htmlFor="orientationSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__orientationLabel"
        >
          {t("profile:orientation.label")}
        </label>
        <select
          id="orientationSelect"
          {...register("orientation", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__orientationSelect"
          required={false}
        >
          <option value="">{t("common:select")}</option>
          <option value="straight">{t("options:orientation.straight")}</option>
          <option value="gay">{t("options:orientation.gay")}</option>
          {/* Keep EN enum 'bisexual' to match JSON keys */}
          <option value="bisexual">{t("options:orientation.bisexual")}</option>
          <option value="other">{t("options:orientation.other")}</option>
        </select>
        {errors.orientation && (
          <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__orientationError">
            {errors.orientation.message}
          </p>
        )}
      </div>

      {/* Height & Unit */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="heightInput"
            className="block font-medium mb-1"
            data-cy="FormBasicInfo__heightLabel"
          >
            {t("profile:height.label")}
          </label>
          <input
            id="heightInput"
            type="number"
            step="1"
            placeholder="e.g. 180"
            {...register("height", withRules(/* optional numeric rules */))}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__heightInput"
            required={false}
          />
          {errors.height && (
            <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__heightError">
              {errors.height.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="heightUnitSelect"
            className="block font-medium mb-1"
            data-cy="FormBasicInfo__heightUnitLabel"
          >
            {t("common:select")}
          </label>
          <select
            id="heightUnitSelect"
            {...register("heightUnit", withRules(/* e.g., { required: t('common:required') } */))}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__heightUnitSelect"
            required={false}
          >
            <option value="">{t("common:select")}</option>
            {/* Store canonical values; display localized text */}
            <option value="Cm">{t("profile:cm")}</option>
            <option value="FtIn">ft/in</option>
          </select>
          {errors.heightUnit && (
            <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__heightUnitError">
              {errors.heightUnit.message}
            </p>
          )}
        </div>
      </div>

      {/* Weight & Unit */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="weightInput"
            className="block font-medium mb-1"
            data-cy="FormBasicInfo__weightLabel"
          >
            {t("profile:weight.label")}
          </label>
          <input
            id="weightInput"
            type="number"
            step="1"
            placeholder="e.g. 70"
            {...register("weight", withRules(/* optional numeric rules */))}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__weightInput"
            required={false}
          />
          {errors.weight && (
            <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__weightError">
              {errors.weight.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="weightUnitSelect"
            className="block font-medium mb-1"
            data-cy="FormBasicInfo__weightUnitLabel"
          >
            {t("common:select")}
          </label>
          <select
            id="weightUnitSelect"
            {...register("weightUnit", withRules(/* e.g., { required: t('common:required') } */))}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__weightUnitSelect"
            required={false}
          >
            <option value="">{t("common:select")}</option>
            <option value="kg">{t("profile:kg")}</option>
            <option value="lb">lb</option>
          </select>
          {errors.weightUnit && (
            <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__weightUnitError">
              {errors.weightUnit.message}
            </p>
          )}
        </div>
      </div>

      {/* Body Type */}
      <div className="w-full">
        <label
          htmlFor="bodyTypeSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__bodyTypeLabel"
        >
          {t("profile:bodyType.label")}
        </label>
        <select
          id="bodyTypeSelect"
          {...register("bodyType", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__bodyTypeSelect"
          required={false}
        >
          <option value="">{t("common:select")}</option>
          <option value="slim">{t("profile:bodyType.slim")}</option>
          <option value="normal">{t("profile:bodyType.normal")}</option>
          <option value="athletic">{t("profile:bodyType.athletic")}</option>
          <option value="overweight">{t("profile:bodyType.overweight")}</option>
          <option value="obese">{t("profile:bodyType.obese")}</option>
        </select>
        {errors.bodyType && (
          <p className="text-red-600 text-sm mt-1" data-cy="FormBasicInfo__bodyTypeError">
            {errors.bodyType.message}
          </p>
        )}
      </div>
    </div>
  );
};

FormBasicInfo.propTypes = {
  t: PropTypes.func.isRequired,
  hideUsernameEmail: PropTypes.bool,
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormBasicInfo;
// --- REPLACE END ---

