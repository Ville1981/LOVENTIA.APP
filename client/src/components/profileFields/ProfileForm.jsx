import React, { useState, useEffect } from "react";
import axios from "axios";
import FormBasicInfo from "./FormBasicInfo";
import FormLocation from "./FormLocation";
import FormEducation from "./FormEducation";
import FormChildrenPets from "./FormChildrenPets";
import FormGoalSummary from "./FormGoalSummary";
import FormLookingFor from "./FormLookingFor";
import MultiStepPhotoUploader from "./MultiStepPhotoUploader";
import { uploadAvatar } from "../../api/images";
import { BACKEND_BASE_URL } from "../../config";

/**
 * ProfileForm
 */
const ProfileForm = ({
  user,
  isPremium,
  values,
  setters: setValues,
  t,
  message,
  success,
  onUserUpdate,
  hideAvatarSection = false,
}) => {
  // Extra images
  const [localExtraImages, setLocalExtraImages] = useState(user.extraImages || []);
  useEffect(() => {
    setLocalExtraImages(user.extraImages || []);
  }, [user.extraImages]);

  // Avatar state
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user.profilePicture
      ? user.profilePicture.startsWith("http")
        ? user.profilePicture
        : `${BACKEND_BASE_URL}${user.profilePicture}`
      : null
  );
  const [avatarError, setAvatarError] = useState(null);

  // Sync preview when user.profilePicture updates
  useEffect(() => {
    if (user.profilePicture) {
      setAvatarPreview(
        user.profilePicture.startsWith("http")
          ? user.profilePicture
          : `${BACKEND_BASE_URL}${user.profilePicture}`
      );
    }
  }, [user.profilePicture]);

  const token = localStorage.getItem("token");

  // Avatar file change
  const handleAvatarChange = (e) => {
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Avatar upload
  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile) return;
    setAvatarError(null);
    try {
      const updatedUser = await uploadAvatar(user._id, avatarFile);
      // Update preview and parent state
      if (updatedUser.profilePicture) {
        setAvatarPreview(
          updatedUser.profilePicture.startsWith("http")
            ? updatedUser.profilePicture
            : `${BACKEND_BASE_URL}${updatedUser.profilePicture}`
        );
      }
      onUserUpdate(updatedUser);
    } catch (err) {
      // Show server error if available
      const msg = err.message || t("profile.avatarUploadFailed");
      setAvatarError(msg);
      console.error("Avatar upload error:", err);
    }
  };

  // Profile save
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        values,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const updatedUser = res.data.user || res.data;
      setLocalExtraImages(updatedUser.extraImages || []);
      onUserUpdate(updatedUser);
    } catch (err) {
      console.error("Profile save failed:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* Avatar section */}
      {!hideAvatarSection && (
        <div className="flex items-center space-x-6">
          <div className="w-12 h-12 rounded-full overflow-hidden border">
            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Profile"
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
              type="button"
              onClick={handleAvatarSubmit}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              🎨 {t("profile.saveAvatar")}
            </button>
            {avatarError && <p className="text-red-600 mt-1">{avatarError}</p>}
          </div>

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
        </div>
      )}

      {/* Basic Info */}
      <FormBasicInfo
        username={values.username}
        setUsername={(v) => setValues((prev) => ({ ...prev, username: v }))}
        email={values.email}
        setEmail={(v) => setValues((prev) => ({ ...prev, email: v }))}
        age={values.age}
        setAge={(v) => setValues((prev) => ({ ...prev, age: v }))}
        gender={values.gender}
        setGender={(v) => setValues((prev) => ({ ...prev, gender: v }))}
        orientation={values.orientation}
        setOrientation={(v) => setValues((prev) => ({ ...prev, orientation: v }))}
        t={t}
      />

      {/* Location */}
      <FormLocation values={values} setters={setValues} t={t} />

      {/* Education */}
      <FormEducation
        education={values.education}
        setEducation={(v) => setValues((prev) => ({ ...prev, education: v }))}
        profession={values.profession}
        setProfession={(v) => setValues((prev) => ({ ...prev, profession: v }))}
        religion={values.religion}
        setReligion={(v) => setValues((prev) => ({ ...prev, religion: v }))}
        religionImportance={values.religionImportance}
        setReligionImportance={(v) => setValues((prev) => ({ ...prev, religionImportance: v }))}
        t={t}
      />

      {/* Children & Pets */}
      <FormChildrenPets
        children={values.children}
        setChildren={(v) => setValues((prev) => ({ ...prev, children: v }))}
        pets={values.pets}
        setPets={(v) => setValues((prev) => ({ ...prev, pets: v }))}
        t={t}
      />

      {/* Goals & Summary */}
      <FormGoalSummary
        summary={values.summary}
        setSummary={(v) => setValues((prev) => ({ ...prev, summary: v }))}
        goal={values.goal}
        setGoal={(v) => setValues((prev) => ({ ...prev, goal: v }))}
        t={t}
      />

      {/* Looking For */}
      <FormLookingFor
        lookingFor={values.lookingFor}
        setLookingFor={(v) => setValues((prev) => ({ ...prev, lookingFor: v }))}
        t={t}
      />

      {/* Extra Photos */}
      <MultiStepPhotoUploader
        userId={user._id}
        isPremium={isPremium}
        extraImages={localExtraImages}
        onSuccess={(result) => {
          const imgs = result.extraImages || [];
          setLocalExtraImages(imgs);
          onUserUpdate({ ...user, extraImages: imgs });
        }}
        onError={(err) => console.error("Photo uploader error:", err)}
      />

      {/* Save Changes */}
      <button
        type="submit"
        className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        💾 {t("profile.saveChanges")}
      </button>

      {message && (
        <p className={`text-center ${success ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default ProfileForm;
