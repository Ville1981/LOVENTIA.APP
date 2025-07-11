import React from "react";
import { useFormContext } from "react-hook-form";
import PropTypes from "prop-types";

/**
 * FormBasicInfo
 * Lomakeosio: käyttäjän perus­tiedot
 * Käyttää RHF-kontekstia kenttien rekisteröintiin ja virheiden näyttöön.
 *
 * Props:
 *   t: lokalisointifunktio (required)
 *   hideUsernameEmail: piilota käyttäjänimi ja sähköposti (oletus: false)
 */
const FormBasicInfo = ({ t, hideUsernameEmail = false }) => {
  const {
    register,
    formState: { errors }
  } = useFormContext();

  // Ikävaihtoehdot 18–99
  const ageOptions = Array.from({ length: 82 }, (_, i) => i + 18);

  return (
    <div className="flex flex-col gap-4 w-full text-left" data-cy="FormBasicInfo__section">
      {/* Käyttäjänimi ja sähköposti */}
      {!hideUsernameEmail && (
        <>
          <div>
            <input
              type="text"
              placeholder={t("profile.username")}
              {...register("username")}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__usernameInput"
            />
            {errors.username && (
              <p
                className="text-red-600 text-sm mt-1"
                data-cy="FormBasicInfo__usernameError"
              >
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <input
              type="email"
              placeholder={t("profile.email")}
              {...register("email")}
              className="p-2 border rounded w-full"
              data-cy="FormBasicInfo__emailInput"
            />
            {errors.email && (
              <p
                className="text-red-600 text-sm mt-1"
                data-cy="FormBasicInfo__emailError"
              >
                {errors.email.message}
              </p>
            )}
          </div>
        </>
      )}

      {/* Tarkka ikä */}
      <div className="w-full">
        <label
          htmlFor="ageSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__ageLabel"
        >
          {t("profile.age")}
        </label>
        <select
          id="ageSelect"
          {...register("age")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__ageSelect"
        >
          <option value="">{t("common.select")}</option>
          {ageOptions.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
        {errors.age && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__ageError"
          >
            {errors.age.message}
          </p>
        )}
      </div>

      {/* Sukupuoli */}
      <div className="w-full">
        <label
          htmlFor="genderSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__genderLabel"
        >
          {t("profile.gender")}
        </label>
        <select
          id="genderSelect"
          {...register("gender")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__genderSelect"
        >
          <option value="">{t("common.select")}</option>
          <option value="Mies">{t("profile.male")}</option>
          <option value="Nainen">{t("profile.female")}</option>
          <option value="Muu">{t("profile.other")}</option>
        </select>
        {errors.gender && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__genderError"
          >
            {errors.gender.message}
          </p>
        )}
      </div>

      {/* Suuntautuminen */}
      <div className="w-full">
        <label
          htmlFor="orientationSelect"
          className="block font-medium mb-1"
          data-cy="FormBasicInfo__orientationLabel"
        >
          ❤️ {t("profile.orientation")}
        </label>
        <select
          id="orientationSelect"
          {...register("orientation")}
          className="p-2 border rounded w-full"
          data-cy="FormBasicInfo__orientationSelect"
        >
          <option value="">{t("common.select")}</option>
          <option value="Hetero">{t("profile.hetero")}</option>
          <option value="Homo">{t("profile.homo")}</option>
          <option value="Bi">{t("profile.bi")}</option>
          <option value="Muu">{t("profile.other")}</option>
        </select>
        {errors.orientation && (
          <p
            className="text-red-600 text-sm mt-1"
            data-cy="FormBasicInfo__orientationError"
          >
            {errors.orientation.message}
          </p>
        )}
      </div>
    </div>
  );
};

FormBasicInfo.propTypes = {
  t: PropTypes.func.isRequired,
  hideUsernameEmail: PropTypes.bool,
};

export default FormBasicInfo;
