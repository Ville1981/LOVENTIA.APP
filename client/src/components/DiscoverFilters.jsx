import React from "react";
import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormLocation from "./profileFields/FormLocation";
import FormEducation from "./profileFields/FormEducation";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLookingFor from "./profileFields/FormLookingFor";

const DiscoverFilters = ({ values, setters, handleFilter, t }) => {
  return (
    <div className="form-container">
      <form onSubmit={handleFilter} className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">{t("discover.title")}</h2>
          <p className="text-gray-600">
            {t("discover.instructions") ||
              "Valitse hakukriteerit löytääksesi sopivia profiileja."}
          </p>
        </div>

        <FormBasicInfo {...values} {...setters} t={t} hideUsernameEmail />
        <FormLocation {...values} {...setters} t={t} />
        <FormEducation {...values} {...setters} t={t} />
        <FormChildrenPets {...values} {...setters} t={t} />
        <FormGoalSummary {...values} {...setters} t={t} />
        <FormLookingFor {...values} {...setters} t={t} />

        <div className="text-center pt-3">
          <button
            type="submit"
            className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition duration-300 ease-in-out"
          >
            🔍 {t("common.filter")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DiscoverFilters;
