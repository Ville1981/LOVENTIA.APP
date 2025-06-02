import React from "react";

const FormBasicInfo = ({
  username, setUsername,
  email, setEmail,
  age, setAge,
  gender, setGender,
  orientation, setOrientation,
  t,
  hideUsernameEmail = false,
}) => {
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
      <input
        type="number"
        placeholder={t("profile.age")}
        value={age}
        onChange={(e) => setAge(e.target.value)}
        className="p-2 border rounded w-full"
      />
      <select
        value={gender}
        onChange={(e) => setGender(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">{t("profile.gender")}</option>
        <option value="Mies">{t("profile.male")}</option>
        <option value="Nainen">{t("profile.female")}</option>
        <option value="Muu">{t("profile.other")}</option>
      </select>

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

export default FormBasicInfo;
