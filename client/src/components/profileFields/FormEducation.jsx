// client/src/components/profileFields/FormEducation.jsx

import React from "react";

const FormEducation = ({
  education,
  setEducation,
  profession,
  setProfession,
  religion,
  setReligion,
  religionImportance,
  setReligionImportance,
  t
}) => {
  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Koulutustaso */}
      <div className="w-full">
        <label htmlFor="education" className="block font-medium mb-1">
          🎓 {t("profile.education")}
        </label>
        <select
          id="education"
          value={education}
          onChange={(e) => setEducation(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Peruskoulu">{t("education.basic")}</option>
          <option value="Toinen aste">{t("education.secondary")}</option>
          <option value="Ammatillinen">{t("education.vocational")}</option>
          <option value="Korkeakoulu / yliopisto">{t("education.higher")}</option>
          <option value="Tohtori / tutkimus">{t("education.phd")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
      </div>

      {/* Ammatti */}
      <div className="w-full">
        <label htmlFor="profession" className="block font-medium mb-1">
          💼 {t("profile.profession")}
        </label>
        <input
          type="text"
          id="profession"
          placeholder={t("profile.profession")}
          value={profession}
          onChange={(e) => setProfession(e.target.value)}
          className="p-2 border rounded w-full"
        />
      </div>

      {/* Uskonto */}
      <div className="w-full">
        <label htmlFor="religion" className="block font-medium mb-1">
          🕊 {t("profile.religion")}
        </label>
        <select
          id="religion"
          value={religion}
          onChange={(e) => setReligion(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Kristinusko">{t("religion.christianity")}</option>
          <option value="Islam">{t("religion.islam")}</option>
          <option value="Hindulaisuus">{t("religion.hinduism")}</option>
          <option value="Buddhalaisuus">{t("religion.buddhism")}</option>
          <option value="Kansanusko">{t("religion.folk")}</option>
          <option value="Uskonnottomuus">{t("religion.none")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
      </div>

      {/* Uskonnon merkitys */}
      <div className="w-full">
        <label htmlFor="religionImportance" className="block font-medium mb-1">
          🕊 {t("profile.religionImportance")}
        </label>
        <select
          id="religionImportance"
          value={religionImportance}
          onChange={(e) => setReligionImportance(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Ei tärkeä">{t("religionImportance.notImportant")}</option>
          <option value="Jonkin verran tärkeä">{t("religionImportance.somewhatImportant")}</option>
          <option value="Erittäin tärkeä">{t("religionImportance.veryImportant")}</option>
        </select>
      </div>
    </div>
  );
};

export default FormEducation;
