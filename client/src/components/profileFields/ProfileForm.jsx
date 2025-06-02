import React from "react";
import FormBasicInfo from "./FormBasicInfo";
import FormLocation from "./FormLocation";
import FormEducation from "./FormEducation";
import FormChildrenPets from "./FormChildrenPets";
import FormGoalSummary from "./FormGoalSummary";
import FormLookingFor from "./FormLookingFor";

const ProfileForm = ({
  values,
  setters,
  t,
  message,
  success,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-[600px] mx-auto">
      {/* Ilmoitukset */}
      {message && (
        <p className="text-center text-red-500 font-semibold">{message}</p>
      )}
      {success && (
        <p className="text-center text-green-600 font-semibold">
          ✅ {t("profile.saved")}
        </p>
      )}

      {/* Lomakeosat */}
      <FormBasicInfo {...values} {...setters} t={t} />
      <FormLocation {...values} {...setters} t={t} />
      <FormEducation {...values} {...setters} t={t} />
      <FormChildrenPets {...values} {...setters} t={t} />
      <FormGoalSummary {...values} {...setters} t={t} />
      <FormLookingFor {...values} {...setters} t={t} />

      {/* Tallennuspainike */}
      <div className="pt-6 flex justify-center">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          💾 {t("profile.saveChanges")}
        </button>
      </div>
    </form>
  );
};

export default ProfileForm;
