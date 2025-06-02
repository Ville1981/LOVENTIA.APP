import React from "react";

const FormLookingFor = ({ lookingFor, setLookingFor, t }) => {
  return (
    <div className="flex flex-col gap-4 w-full text-left">
      <div className="w-full">
        <label htmlFor="lookingFor" className="block font-medium mb-1">
          🔍 {t("profile.searchingFor")}
        </label>
        <select
          id="lookingFor"
          value={lookingFor}
          onChange={(e) => setLookingFor(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Ystävää">{t("looking.friend")}</option>
          <option value="Tutustumassa">{t("looking.gettingToKnow")}</option>
          <option value="Deittailua">{t("looking.dating")}</option>
          <option value="Treffejä">{t("looking.dates")}</option>
          <option value="Pitkäaikaista suhdetta">{t("looking.longTerm")}</option>
          <option value="Pitkää vakavaa parisuhdetta / avioliittoa">
            {t("looking.marriage")}
          </option>
          <option value="Vain juttuseuraa / keskustelukaveria">
            {t("looking.chatOnly")}
          </option>
          <option value="Satunnaisia tapaamisia">{t("looking.casual")}</option>
          <option value="En tiedä vielä">{t("looking.undecided")}</option>
          <option value="Muu">{t("common.other")}</option>
        </select>
      </div>
    </div>
  );
};

export default FormLookingFor;
