// client/src/components/profileFields/FormBasicInfo.jsx

import React from "react";
import PropTypes from "prop-types";

const FormBasicInfo = ({
  username,
  setUsername,
  email,
  setEmail,
  age,
  setAge,
  gender,
  setGender,
  orientation,
  setOrientation,
  minAge,
  maxAge,
  setMinAge,
  setMaxAge,
  t,
  hideUsernameEmail = false,
}) => {
  const ageOptions = [];
  for (let i = 18; i <= 99; i++) {
    ageOptions.push(i);
  }

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {!hideUsernameEmail && (
        <>
          <input
            type="text"
            placeholder={t("profile.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-2 border rounded w-full"
          />
          <input
            type="email"
            placeholder={t("profile.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded w-full"
          />
        </>
      )}

      {/* Exact age (used in profile, not filters) */}
      <div className="w-full">
        <label className="block font-medium mb-1">{t("profile.age")}</label>
        <select
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          {ageOptions.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      </div>

      {/* Filter: minAge */}
      {setMinAge && setMaxAge && (
        <div className="flex gap-4">
          <div className="w-full">
            <label className="block font-medium mb-1">{t("discover.minAge")}</label>
            <select
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              className="p-2 border rounded w-full"
            >
              {ageOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block font-medium mb-1">{t("discover.maxAge")}</label>
            <select
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              className="p-2 border rounded w-full"
            >
              {ageOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="w-full">
        <label className="block font-medium mb-1">{t("profile.gender")}</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Mies">{t("profile.male")}</option>
          <option value="Nainen">{t("profile.female")}</option>
          <option value="Muu">{t("profile.other")}</option>
        </select>
      </div>

      <div className="w-full">
        <label className="block font-medium mb-1">❤️ {t("profile.orientation")}</label>
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">{t("common.select")}</option>
          <option value="Hetero">{t("profile.hetero")}</option>
          <option value="Homo">{t("profile.homo")}</option>
          <option value="Bi">{t("profile.bi")}</option>
          <option value="Muu">{t("profile.other")}</option>
        </select>
      </div>
    </div>
  );
};

FormBasicInfo.propTypes = {
  username: PropTypes.string,
  setUsername: PropTypes.func,
  email: PropTypes.string,
  setEmail: PropTypes.func,
  age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  setAge: PropTypes.func.isRequired,
  gender: PropTypes.string.isRequired,
  setGender: PropTypes.func.isRequired,
  orientation: PropTypes.string.isRequired,
  setOrientation: PropTypes.func.isRequired,
  minAge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  maxAge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setMinAge: PropTypes.func,
  setMaxAge: PropTypes.func,
  t: PropTypes.func.isRequired,
  hideUsernameEmail: PropTypes.bool,
};

export default FormBasicInfo;
