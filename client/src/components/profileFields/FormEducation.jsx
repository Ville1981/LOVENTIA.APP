// --- REPLACE START: enforce EN enum values for backend; add search-mode validation gating; keep labels localized ---
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
 *   disableValidation / mode="search": when active, do NOT register RHF required rules
 *     and do NOT add DOM `required` attribute. Also, avoid forcing defaults that would
 *     make the field effectively mandatory during search.
 */
const FormEducation = ({
  t,
  includeAllOption = false,
  disableValidation = false,
  mode = undefined,
}) => {
  // In search mode we suppress any validation rules/DOM required attributes.
  const searchMode = !!disableValidation || mode === "search";
  const {
    register,
    formState: { errors },
  } = useFormContext();

  // Helper to optionally apply rules (future-proof if rules are added later)
  const withRules = (rules) => (searchMode ? {} : rules || {});

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormEducation__section">
      {/* Education level */}
      <div className="w-full">
        <label htmlFor="education" className="block font-medium mb-1">
          🎓 {t("profile:education.label")}
        </label>
        <select
          id="education"
          // No required rules in search mode; currently we register plain field without rules.
          {...register("education", withRules(/* e.g., { required: t('common:required') } */))}
          className="p-2 border rounded w-full"
          data-cy="FormEducation__educationSelect"
          // Keep DOM free of `required` in search mode (explicit false for clarity)
          required={false}
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
  disableValidation: PropTypes.bool,
  mode: PropTypes.oneOf([undefined, "search"]),
};

export default FormEducation;
// --- REPLACE END ---

