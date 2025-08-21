// --- REPLACE START: i18n namespace fixes (ns.key -> ns:key), no logic removed ---
// --- REPLACE END ---
// src/components/profileFields/FormBasicInfo.jsx
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
 */
const FormBasicInfo = ({ t, hideUsernameEmail = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Age options: 18–99
  const ageOptions = Array.from({ length: 82 }, (_, i) => i + 18);

  return (
    <div
      className="flex flex-col gap-4 w-full text-left"
      data-cy="FormBasicInfo__section"
    >
      {/* Username & Email */}
      {!hideUsernameEmail && (
        <>
          <div>
            <input
              type="text"
              placeholder={t("profile:username")}
              {...register("username")}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__usernameInput"
            />
            {errors.username && (
              <p
                className="text-red-600 text-sm mt-1"
                data-cy="FormBasicInfo__usernameError"
              >
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <input
              type="email"
              placeholder={t("profile:email")}
              {...register("email")}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__emailInput"
            />
            {errors.email && (
              <p
                className="text-red-600 text-sm mt-1"
                data-cy="FormBasicInfo__emailError"
              >
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
          {...register("age")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__ageSelect"
        >
          <option value="">{t("common:select")}</option>
          {ageOptions.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
        {errors.age && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__ageError"
          >
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
          {...register("gender")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__genderSelect"
        >
          <option value="">{t("common:select")}</option>
          <option value="male">{t("profile:male")}</option>
          <option value="female">{t("profile:female")}</option>
          <option value="other">{t("profile:other")}</option>
        </select>
        {errors.gender && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__genderError"
          >
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
          {...register("orientation")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__orientationSelect"
        >
          <option value="">{t("common:select")}</option>
          <option value="straight">{t("profile:straight")}</option>
          <option value="gay">{t("profile:gay")}</option>
          <option value="bi">{t("profile:bi")}</option>
          <option value="other">{t("profile:other")}</option>
        </select>
        {errors.orientation && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__orientationError"
          >
            {errors.orientation.message}
          </p>
        )}
      </div>

      {/* Height & Unit */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="heightInput" className="block font-medium mb-1">
            {t("profile:height")}
          </label>
          <input
            id="heightInput"
            type="number"
            step="1"
            placeholder="e.g. 180"
            {...register("height")}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__heightInput"
          />
          {errors.height && (
            <p
              className="text-red-600 text-sm mt-1"
              data-cy="FormBasicInfo__heightError"
            >
              {errors.height.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="heightUnitSelect" className="block font-medium mb-1">
            {t("profile:heightUnit")}
          </label>
          <select
            id="heightUnitSelect"
            {...register("heightUnit")}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__heightUnitSelect"
          >
            <option value="">{t("common:select")}</option>
            <option value="Cm">cm</option>
            <option value="FtIn">ft/in</option>
          </select>
          {errors.heightUnit && (
            <p
              className="text-red-600 text-sm mt-1"
              data-cy="FormBasicInfo__heightUnitError"
            >
              {errors.heightUnit.message}
            </p>
          )}
        </div>
      </div>

      {/* Weight & Unit */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="weightInput" className="block font-medium mb-1">
            {t("profile:weight")}
          </label>
          <input
            id="weightInput"
            type="number"
            step="1"
            placeholder="e.g. 70"
            {...register("weight")}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__weightInput"
          />
          {errors.weight && (
            <p
              className="text-red-600 text-sm mt-1"
              data-cy="FormBasicInfo__weightError"
            >
              {errors.weight.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="weightUnitSelect" className="block font-medium mb-1">
            {t("profile:weightUnit")}
          </label>
          <select
            id="weightUnitSelect"
            {...register("weightUnit")}
            className="p-2 border rounded w-full"
            data-cy="FormBasicInfo__weightUnitSelect"
          >
            <option value="">{t("common:select")}</option>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
          {errors.weightUnit && (
            <p
              className="text-red-600 text-sm mt-1"
              data-cy="FormBasicInfo__weightUnitError"
            >
              {errors.weightUnit.message}
            </p>
          )}
        </div>
      </div>

      {/* Body Type */}
      <div className="w-full">
        <label htmlFor="bodyTypeSelect" className="block font-medium mb-1">
          {t("profile:bodyType.label")}
        </label>
        <select
          id="bodyTypeSelect"
          {...register("bodyType")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__bodyTypeSelect"
        >
          <option value="">{t("common:select")}</option>
          <option value="Slim">{t("profile:bodyType.slim")}</option>
          <option value="Normal">{t("profile:bodyType.normal")}</option>
          <option value="Athletic">{t("profile:bodyType.athletic")}</option>
          <option value="Overweight">{t("profile:bodyType.overweight")}</option>
          <option value="Obese">{t("profile:bodyType.obese")}</option>
        </select>
        {errors.bodyType && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__bodyTypeError"
          >
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
};

export default FormBasicInfo;
