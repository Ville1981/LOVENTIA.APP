import PropTypes from "prop-types";
import React from "react";
import { useFormContext } from "react-hook-form";

/**
 * FormGoalSummary
 * Section for profile summary and goals.
 * Uses React Hook Form context to register fields and display errors.
 *
 * Props:
 *   t: localization function (required)
 *   summaryField: the field name for the summary textarea (default: "summary")
 *   goalField: the field name for the goals textarea (default: "goal")
 */
const FormGoalSummary = ({
  t,
  summaryField = "summary",
  goalField = "goal",
}) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div
      className="flex flex-col gap-4 w-full text-left"
      data-cy="FormGoalSummary__section"
    >
      {/* Profile summary */}
      <div className="w-full">
        <label
          htmlFor={summaryField}
          className="block font-medium mb-1"
          data-cy="FormGoalSummary__summaryLabel"
        >
          📄 {t("profile.about")}
        </label>
        <textarea
          id={summaryField}
          {...register(summaryField)}
          placeholder={t("profile.about")}
          className="p-2 border rounded w-full"
          rows={3}
          data-cy="FormGoalSummary__summaryInput"
        />
        {errors[summaryField] && (
          <p
            className="mt-1 text-sm text-red-600"
            data-cy="FormGoalSummary__summaryError"
          >
            {errors[summaryField].message}
          </p>
        )}
      </div>

      {/* Profile goals */}
      <div className="w-full">
        <label
          htmlFor={goalField}
          className="block font-medium mb-1"
          data-cy="FormGoalSummary__goalLabel"
        >
          🎯 {t("profile.goals")}
        </label>
        <textarea
          id={goalField}
          {...register(goalField)}
          placeholder={t("profile.goals")}
          className="p-2 border rounded w-full"
          rows={3}
          data-cy="FormGoalSummary__goalInput"
        />
        {errors[goalField] && (
          <p
            className="mt-1 text-sm text-red-600"
            data-cy="FormGoalSummary__goalError"
          >
            {errors[goalField].message}
          </p>
        )}
      </div>
    </div>
  );
};

FormGoalSummary.propTypes = {
  t: PropTypes.func.isRequired,
  summaryField: PropTypes.string,
  goalField: PropTypes.string,
};

export default FormGoalSummary;
