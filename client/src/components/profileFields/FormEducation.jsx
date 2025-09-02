// --- REPLACE START: enforce EN enum values for backend; keep labels localized ---
import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormEducation
 * Form section: education level (only)
 * Uses RHF context for field registration and error display.
 *
 * Props:
 *   t: i18n translate function (required)
 *   includeAllOption: adds an "All" option at the top (default false)
 */
const FormEducation = ({ t, includeAllOption = false }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div
      className="flex flex-col gap-4 w-full text-left"
      data-cy="FormEducation__section"
    >
      {/* Education level */}
      <div className="w-full">
        <label htmlFor="education" className="block font-medium mb-1">
          🎓 {t("profile:education.label")}
        </label>
        <select
          id="education"
          {...register("education")}
          className="p-2 border rounded w-full"
          data-cy="FormEducation__educationSelect"
        >
          {includeAllOption && <option value="">{t("common:all")}</option>}
          <option value="">{t("common:select")}</option>

          {/* Values are EN enums expected by backend; labels are localized */}
          <option value="primary">{t("profile:education.basic")}</option>
          <option value="secondary">{t("profile:education.secondary")}</option>
          <option value="vocational">{t("profile:education.vocational")}</option>
          <option value="college_university">{t("profile:education.higher")}</option>
          <option value="doctorate_research">{t("profile:education.phd")}</option>
          <option value="other">{t("common:other")}</option>
        </select>

        {errors.education && (
          <p
            className="mt-1 text-sm text-red-600"
            data-cy="FormEducation__educationError"
          >
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
// --- REPLACE END ---
