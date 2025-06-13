// client/src/components/profileFields/ProfileForm.jsx

import React, { useState } from "react";
import FormBasicInfo from "./FormBasicInfo";
import FormLocation from "./FormLocation";
import FormEducation from "./FormEducation";
import FormChildrenPets from "./FormChildrenPets";
import FormGoalSummary from "./FormGoalSummary";
import FormLookingFor from "./FormLookingFor";
import ExtraPhotosFields from "./ExtraPhotosFields";
import { uploadAvatar } from "../../api/images";
import { BACKEND_BASE_URL } from "../../config";

/**
 * ProfileForm
 * @param {object} props
 * @param {object} props.user             - Käyttäjädata
 * @param {boolean} props.isPremium       - Premium-oikeudet kuvien määrä
 * @param {object} props.values           - Lomakekenttien arvot
 * @param {object} props.setters          - Lomakekenttien setteri-funktiot
 * @param {function} props.t              - Käännösfunktio
 * @param {string} props.message         - Status-viesti
 * @param {boolean} props.success        - Status-viestin tyyli (onnistuiko)
 * @param {function} props.onUserUpdate  - Callback päivitetyn käyttäjädatan käsittelyyn
 * @param {boolean} [props.hideAvatarSection=false] - Piilottaa avatar-latausosion
 */
const ProfileForm = ({
  user,
  isPremium,
  values,
  setters,
  t,
  message,
  success,
  onUserUpdate,
  hideAvatarSection = false,
}) => {
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user.profilePicture
      ? user.profilePicture.startsWith("http")
        ? user.profilePicture
        : `${BACKEND_BASE_URL}/${user.profilePicture}`
      : null
  );
  const [avatarError, setAvatarError] = useState(null);

  // Avatar-muutos
  const handleAvatarChange = (e) => {
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Avatar-lataus
  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile) return;
    setAvatarError(null);
    try {
      const updatedUser = await uploadAvatar(user._id, avatarFile);
      onUserUpdate(updatedUser);
    } catch (err) {
      setAvatarError("Avatar-lataus epäonnistui");
      console.error(err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* Avatar-osio (voidaan piilottaa hideAvatarSection-propilla) */}
      {!hideAvatarSection && (
        <form onSubmit={handleAvatarSubmit} className="flex items-center space-x-6">
          <div className="w-12 h-12 rounded-full overflow-hidden border">
            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Profiilikuva"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder-avatar-male.png";
                }}
              />
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              🎨 {t("profile.saveAvatar")}
            </button>
            {avatarError && <p className="text-red-600 mt-1">{avatarError}</p>}
          </div>

          {/* Käyttäjätunnus ja sijainti */}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold">{user.username}</h2>
            <p className="text-gray-600">
              {values.country && (
                <>
                  {values.country}
                  {values.region && `, ${values.region}`}
                  {values.city && `, ${values.city}`}
                </>
              )}
            </p>
          </div>
        </form>
      )}

      {/* Perustiedot */}
      <FormBasicInfo values={values} setters={setters} t={t} />

      {/* Sijainti: maa/osavaltio/kaupunki */}
      <FormLocation values={values} setters={setters} t={t} />

      {/* Koulutus */}
      <FormEducation values={values} setters={setters} t={t} />

      {/* Lapset ja lemmikit */}
      <FormChildrenPets values={values} setters={setters} t={t} />

      {/* Goals & Summary */}
      <FormGoalSummary values={values} setters={setters} t={t} />

      {/* Looking For */}
      <FormLookingFor values={values} setters={setters} t={t} />

      {/* Extra Photos */}
      <ExtraPhotosFields
        userId={user._id}
        isPremium={isPremium}
        extraImages={user.extraImages || []}
        onSuccess={onUserUpdate}
        onError={(err) => console.error(err)}
      />

      {/* Tallenna loput muutokset */}
      <button
        onClick={setters.handleSubmit}
        className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        💾 {t("profile.saveChanges")}
      </button>

      {message && (
        <p className={`text-center ${success ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default ProfileForm;
