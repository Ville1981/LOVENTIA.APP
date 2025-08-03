import React from "react";

const LookingForField = ({ lookingFor, setLookingFor, t }) => (
  <div className="mt-4">
    <label className="block font-medium">🔍 {t("profile.searchingFor")}</label>
    <select
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
      <option value="Pitkää vakavaa parisuhdetta / avioliittoa">{t("looking.marriage")}</option>
      <option value="Vain juttuseuraa / keskustelukaveria">{t("looking.chatOnly")}</option>
      <option value="Satunnaisia tapaamisia">{t("looking.casual")}</option>
      <option value="En tiedä vielä">{t("looking.undecided")}</option>
      <option value="Muu">{t("common.other")}</option>
    </select>
  </div>
);

export default LookingForField;
