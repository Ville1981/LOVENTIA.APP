// src/components/DiscoverFilters.jsx

import React from "react";
import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormLocation from "./profileFields/FormLocation";
import FormEducation from "./profileFields/FormEducation";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLookingFor from "./profileFields/FormLookingFor";

const DiscoverFilters = ({ values, setters, handleFilter, t }) => {
  return (
    <div className="w-full">
      <form onSubmit={handleFilter} className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">{t("discover.title")}</h2>
          <p className="text-gray-600">
            {t("discover.instructions") ||
              "Valitse hakukriteerit löytääksesi sopivia profiileja."}
          </p>
        </div>

        {/* Perustiedot: Ikä, Sukupuoli, Orientaatio (käyttäjänimi/sähköposti piilotetaan) */}
        <FormBasicInfo {...values} {...setters} t={t} hideUsernameEmail />

        {/* Sijainti: Maa, Alue, Kaupunki */}
        <FormLocation {...values} {...setters} t={t} />

        {/* Koulutus */}
        <FormEducation {...values} {...setters} t={t} />

        {/* Lapsi & Lemmikki */}
        <FormChildrenPets {...values} {...setters} t={t} />

        {/* Tavoitteet ja tiivistelmä */}
        <FormGoalSummary {...values} {...setters} t={t} />

        {/* Mitä etsit? */}
        <FormLookingFor {...values} {...setters} t={t} />

        <div className="text-center pt-3">
          <button
            type="submit"
            className="bg-[#FF4081] text-white font-bold py-2 px-8 rounded-full hover:opacity-90 transition duration-200"
          >
            🔍 {t("common.filter")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DiscoverFilters;
