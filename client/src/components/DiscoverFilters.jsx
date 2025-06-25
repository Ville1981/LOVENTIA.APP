import React, { memo } from "react";
import PropTypes from "prop-types";

import FormBasicInfo from "./profileFields/FormBasicInfo";
import FormLocation from "./profileFields/FormLocation";
import FormEducation from "./profileFields/FormEducation";
import FormChildrenPets from "./profileFields/FormChildrenPets";
import FormGoalSummary from "./profileFields/FormGoalSummary";
import FormLookingFor from "./profileFields/FormLookingFor";

const DiscoverFilters = ({ values, setters, handleFilter, t }) => {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleFilter} className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">{t("discover.title")}</h2>
          <p className="text-gray-600">
            {t("discover.instructions") ||
              "Select filter criteria to find matching profiles."}
          </p>
        </div>

        {/* Basic Info */}
        <FormBasicInfo
          age={values.age}
          gender={values.gender}
          orientation={values.orientation}
          setAge={setters.setAge}
          setGender={setters.setGender}
          setOrientation={setters.setOrientation}
          minAge={values.minAge}
          maxAge={values.maxAge}
          setMinAge={setters.setMinAge}
          setMaxAge={setters.setMaxAge}
          t={t}
          hideUsernameEmail
        />

        {/* Location */}
        <FormLocation
          country={values.country}
          region={values.region}
          city={values.city}
          customCountry={values.customCountry}
          customRegion={values.customRegion}
          customCity={values.customCity}
          setCountry={setters.setCountry}
          setRegion={setters.setRegion}
          setCity={setters.setCity}
          setCustomCountry={setters.setCustomCountry}
          setCustomRegion={setters.setCustomRegion}
          setCustomCity={setters.setCustomCity}
          t={t}
        />

        {/* Education & Profession */}
        <FormEducation
          education={values.education}
          profession={values.profession}
          setEducation={setters.setEducation}
          setProfession={setters.setProfession}
          t={t}
        />

        {/* Children & Pets */}
        <FormChildrenPets
          children={values.children}
          pets={values.pets}
          setChildren={setters.setChildren}
          setPets={setters.setPets}
          t={t}
        />

        {/* Goals & Summary */}
        <FormGoalSummary
          summary={values.summary}
          goals={values.goals}
          setSummary={setters.setSummary}
          setGoals={setters.setGoals}
          t={t}
        />

        {/* Looking For */}
        <FormLookingFor
          lookingFor={values.lookingFor}
          setLookingFor={setters.setLookingFor}
          t={t}
        />

        {/* Submit Button */}
        <div className="text-center pt-3">
          <button
            type="submit"
            className="bg-pink-600 text-white font-bold py-2 px-8 rounded-full hover:opacity-90 transition duration-200"
          >
            🔍 {t("common.filter") || "Filter"}
          </button>
        </div>
      </form>
    </div>
  );
};

DiscoverFilters.propTypes = {
  values: PropTypes.shape({
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    gender: PropTypes.string,
    orientation: PropTypes.string,
    country: PropTypes.string,
    region: PropTypes.string,
    city: PropTypes.string,
    customCountry: PropTypes.string,
    customRegion: PropTypes.string,
    customCity: PropTypes.string,
    education: PropTypes.string,
    profession: PropTypes.string,
    children: PropTypes.string,
    pets: PropTypes.string,
    summary: PropTypes.string,
    goals: PropTypes.string,
    lookingFor: PropTypes.string,
    minAge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    maxAge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  setters: PropTypes.shape({
    setAge: PropTypes.func.isRequired,
    setGender: PropTypes.func.isRequired,
    setOrientation: PropTypes.func.isRequired,
    setCountry: PropTypes.func.isRequired,
    setRegion: PropTypes.func.isRequired,
    setCity: PropTypes.func.isRequired,
    setCustomCountry: PropTypes.func.isRequired,
    setCustomRegion: PropTypes.func.isRequired,
    setCustomCity: PropTypes.func.isRequired,
    setEducation: PropTypes.func.isRequired,
    setProfession: PropTypes.func.isRequired,
    setChildren: PropTypes.func.isRequired,
    setPets: PropTypes.func.isRequired,
    setSummary: PropTypes.func.isRequired,
    setGoals: PropTypes.func.isRequired,
    setLookingFor: PropTypes.func.isRequired,
    setMinAge: PropTypes.func.isRequired,
    setMaxAge: PropTypes.func.isRequired,
  }).isRequired,
  handleFilter: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default memo(DiscoverFilters);
