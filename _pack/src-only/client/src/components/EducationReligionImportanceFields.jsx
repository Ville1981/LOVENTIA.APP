import React from "react";

const EducationReligionImportanceFields = ({
  education,
  setEducation,
  religionImportance,
  setReligionImportance,
  t,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <div>
      <label className="block font-medium">🎓 {t("profile:education.label")}</label>
      <select
        value={education}
        onChange={(e) => setEducation(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">{t("common:select")}</option>
        <option value="Peruskoulu">{t("profile:basicEducation")}</option>
        <option value="Toisen asteen tutkinto">{t("profile:secondary")}</option>
        <option value="Alempi korkeakoulututkinto">
          {t("profile:lowerUni")}
        </option>
        <option value="Ylempi korkeakoulututkinto">
          {t("profile:upperUni")}
        </option>
        <option value="Tohtori">{t("profile:phd")}</option>
      </select>
    </div>
    <div>
      <label className="block font-medium">
        🕊 {t("profile:religionImportance.label")}
      </label>
      <select
        value={religionImportance}
        onChange={(e) => setReligionImportance(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">{t("common:select")}</option>
        <option value="Ei tärkeä">
          {t("profile:religionImportance.notImportant")}
        </option>
        <option value="Jonkin verran tärkeä">
          {t("profile:religionImportance.somewhatImportant")}
        </option>
        <option value="Erittäin tärkeä">
          {t("profile:religionImportance.veryImportant")}
        </option>
      </select>
    </div>
  </div>
);

export default EducationReligionImportanceFields;
