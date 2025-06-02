import React from "react";

const FormChildrenPets = ({
  children,
  setChildren,
  pets,
  setPets,
  t,
}) => {
  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Lapset */}
      <div className="w-full">
        <label htmlFor="children" className="block font-medium mb-1">
          👶 {t("profile.children")}
        </label>
        <select
          id="children"
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

      {/* Lemmikit */}
      <div className="w-full">
        <label htmlFor="pets" className="block font-medium mb-1">
          🐾 {t("profile.pets")}
        </label>
        <select
          id="pets"
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
};

export default FormChildrenPets;
