import React from "react";

const FormGoalSummary = ({
  summary,
  setSummary,
  goal,
  setGoal,
  t,
}) => {
  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Kuvaus / itsestä */}
      <div className="w-full">
        <label htmlFor="summary" className="block font-medium mb-1">
          📄 {t("profile.about")}
        </label>
        <textarea
          id="summary"
          placeholder={t("profile.about")}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="p-2 border rounded w-full"
          rows={3}
        />
      </div>

      {/* Tavoitteet */}
      <div className="w-full">
        <label htmlFor="goal" className="block font-medium mb-1">
          🎯 {t("profile.goals")}
        </label>
        <textarea
          id="goal"
          placeholder={t("profile.goals")}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="p-2 border rounded w-full"
          rows={3}
        />
      </div>
    </div>
  );
};

export default FormGoalSummary;
