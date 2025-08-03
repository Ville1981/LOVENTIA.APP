import React from "react";

const ChildrenPetsFields = ({ children, setChildren, pets, setPets, t }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <div>
      <label className="block font-medium">👶 {t("profile.children")}</label>
      <select
        value={children}
        onChange={(e) => setChildren(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">{t("common.select")}</option>
        <option value="Kyllä">{t("profile.childrenYes")}</option>
        <option value="Ei">{t("profile.childrenNo")}</option>
        <option value="Aikuisia lapsia">{t("profile.childrenAdult")}</option>
        <option value="Muu">{t("common.other")}</option>
      </select>
    </div>
    <div>
      <label className="block font-medium">🐾 {t("profile.pets")}</label>
      <select
        value={pets}
        onChange={(e) => setPets(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">{t("common.select")}</option>
        <option value="Kissa">{t("pets.cat")}</option>
        <option value="Koira">{t("pets.dog")}</option>
        <option value="Molemmat">{t("pets.both")}</option>
        <option value="Muu">{t("common.other")}</option>
        <option value="Ei lemmikkiä">{t("pets.none")}</option>
      </select>
    </div>
  </div>
);

export default ChildrenPetsFields;
