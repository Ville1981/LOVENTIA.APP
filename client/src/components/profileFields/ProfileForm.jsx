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

const ProfileForm = ({
  user,
  isPremium,
  values,
  setters,
  t,
  message,
  success,
  onUserUpdate,
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

  const handleAvatarChange = (e) => {
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

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
      <form onSubmit={handleAvatarSubmit} className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border">
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
          <div className="flex flex-col">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block mb-2"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              💾 {t("profile.saveChanges")}
            </button>
            {avatarError && (
              <p className="text-red-600 mt-1">{avatarError}</p>
            )}
          </div>
        </div>
      </form>

      {/* Basic info */}
      <FormBasicInfo values={values} setters={setters} t={t} />

      {/* Location */}
      <FormLocation values={values} setters={setters} t={t} />

      {/* Education */}
      <FormEducation values={values} setters={setters} t={t} />

      {/* Children & Pets */}
      <FormChildrenPets values={values} setters={setters} t={t} />

      {/* Goal & Summary */}
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

      {/* Submit whole profile */}
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
