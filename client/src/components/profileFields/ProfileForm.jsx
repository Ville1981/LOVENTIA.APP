import React, { useState, useEffect } from "react";
import axios from "axios";
import FormBasicInfo from "./FormBasicInfo";
import FormLocation from "./FormLocation";
import FormEducation from "./FormEducation";
import FormChildrenPets from "./FormChildrenPets";
import FormLifestyle from "./FormLifestyle";
import FormGoalSummary from "./FormGoalSummary";
import FormLookingFor from "./FormLookingFor";
import MultiStepPhotoUploader from "./MultiStepPhotoUploader";
import { uploadAvatar } from "../../api/images";
import { BACKEND_BASE_URL } from "../../config";

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
  // Extra images state
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
      if (updatedUser.profilePicture) {
        setAvatarPreview(
          updatedUser.profilePicture.startsWith("http")
            ? updatedUser.profilePicture
            : `${BACKEND_BASE_URL}${updatedUser.profilePicture}`
        );
      }
      onUserUpdate(updatedUser);
    } catch (err) {
      const msg = err.message || t("profile.avatarUploadFailed");
      setAvatarError(msg);
      console.error("Avatar upload error:", err);
    }
  };

  // Main form submit (build and send full payload)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      username: values.username,
      email: values.email,
      age: values.age ? Number(values.age) : null,
      gender: values.gender,
      orientation: values.orientation,
      country: values.country,
      region: values.region,
      city: values.city,
      customCountry: values.customCountry,
      customRegion: values.customRegion,
      customCity: values.customCity,
      education: values.education,
      profession: values.profession,
      religion: values.religion,
      religionImportance: values.religionImportance,
      children: values.children,
      pets: values.pets,
      smoke: values.smoke || "",
      drink: values.drink || "",
      drugs: values.drugs || "",
      height: values.height ? Number(values.height) : null,
      weight: values.weight ? Number(values.weight) : null,
      bodyType: values.bodyType,
      activityLevel: values.activityLevel,
      nutritionPreferences: values.nutritionPreferences || "",
      healthInfo: values.healthInfo || "",
      summary: values.summary,
      goal: values.goal,
      lookingFor: values.lookingFor,
      extraImages: localExtraImages,
      latitude: values.latitude || null,
      longitude: values.longitude || null,
    };

    console.log("📤 Lähetettävä payload:", payload);
    try {
      const res = await axios.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedUser = res.data.user || res.data;
      setLocalExtraImages(updatedUser.extraImages || []);
      onUserUpdate(updatedUser);
    } catch (err) {
      console.error("Profile save failed:", err.response || err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* Avatar section */}
      {!hideAvatarSection && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border mx-auto">
            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Profile"
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder-avatar-male.png";
                }}
              />
            )}
          </div>
          <div className="flex space-x-4">
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
          </div>
          {avatarError && <p className="text-red-600">{avatarError}</p>}
        </div>
      )}

      {/* Basic info */}
      <FormBasicInfo
        username={values.username}
        setUsername={(v) => setValues(prev => ({ ...prev, username: v }))}
        email={values.email}
        setEmail={(v) => setValues(prev => ({ ...prev, email: v }))}
        age={values.age}
        setAge={(v) => setValues(prev => ({ ...prev, age: v }))}
        gender={values.gender}
        setGender={(v) => setValues(prev => ({ ...prev, gender: v }))}
        orientation={values.orientation}
        setOrientation={(v) => setValues(prev => ({ ...prev, orientation: v }))}
        t={t}
      />

      {/* Location */}
      <FormLocation
        country={values.country}
        region={values.region}
        city={values.city}
        customCountry={values.customCountry}
        customRegion={values.customRegion}
        customCity={values.customCity}
        setCountry={(v) => setValues(prev => ({ ...prev, country: v }))}
        setRegion={(v) => setValues(prev => ({ ...prev, region: v }))}
        setCity={(v) => setValues(prev => ({ ...prev, city: v }))}
        setCustomCountry={(v) => setValues(prev => ({ ...prev, customCountry: v }))}
        setCustomRegion={(v) => setValues(prev => ({ ...prev, customRegion: v }))}
        setCustomCity={(v) => setValues(prev => ({ ...prev, customCity: v }))}
        t={t}
      />

      {/* Education & work */}
      <FormEducation
        education={values.education}
        setEducation={(v) => setValues(prev => ({ ...prev, education: v }))}
        profession={values.profession}
        setProfession={(v) => setValues(prev => ({ ...prev, profession: v }))}
        religion={values.religion}
        setReligion={(v) => setValues(prev => ({ ...prev, religion: v }))}
        religionImportance={values.religionImportance}
        setReligionImportance={(v) => setValues(prev => ({ ...prev, religionImportance: v }))}
        t={t}
      />

      {/* Children & Pets */}
      <FormChildrenPets
        children={values.children}
        setChildren={(v) => setValues(prev => ({ ...prev, children: v }))}
        pets={values.pets}
        setPets={(v) => setValues(prev => ({ ...prev, pets: v }))}
        t={t}
      />

      {/* Lifestyle */}
      <FormLifestyle
        smoke={values.smoke || ""}
        setSmoke={(v) => setValues(prev => ({ ...prev, smoke: v }))}
        drink={values.drink || ""}
        setDrink={(v) => setValues(prev => ({ ...prev, drink: v }))}
        drugs={values.drugs || ""}
        setDrugs={(v) => setValues(prev => ({ ...prev, drugs: v }))}
        t={t}
      />

      {/* Metrics & Nutrition */}
      <div className="space-y-6">
        {/* Height & Weight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-700">
              {t("profile.height")} (cm)
            </label>
            <input
              type="number"
              id="height"
              value={values.height || ""}
              onChange={(e) => setValues(prev => ({ ...prev, height: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
              {t("profile.weight")} (kg)
            </label>
            <input
              type="number"
              id="weight"
              value={values.weight || ""}
              onChange={(e) => setValues(prev => ({ ...prev, weight: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>

        {/* Body Type & Activity Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodyType" className="block text-sm font-medium text-gray-700">
              {t("profile.bodyType")}
            </label>
            <select
              id="bodyType"
              value={values.bodyType || ""}
              onChange={(e) => setValues(prev => ({ ...prev, bodyType: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            >
              <option value="">{t("common.select")}</option>
              <option value="slim">{t("profile.slim")}</option>
              <option value="normal">{t("profile.normal")}</option>
              <option value="athletic">{t("profile.athletic")}</option>
              <option value="overweight">{t("profile.overweight")}</option>
              <option value="obese">{t("profile.obese")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="activityLevel" className="block text-sm font-medium text-gray-700">
              {t("profile.activityLevel")}
            </label>
            <select
              id="activityLevel"
              value={values.activityLevel || ""}
              onChange={(e) => setValues(prev => ({ ...prev, activityLevel: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            >
              <option value="">{t("common.select")}</option>
              <option value="sedentary">{t("profile.sedentary")}</option>
              <option value="light">{t("profile.light")}</option>
              <option value="moderate">{t("profile.moderate")}</option>
              <option value="active">{t("profile.active")}</option>
              <option value="veryActive">{t("profile.veryActive")}</option>
            </select>
          </div>
        </div>

        {/* Nutrition Preferences (single-select) */}
        <div>
          <label htmlFor="nutritionPreferences" className="block text-sm font-medium text-gray-700">
            {t("profile.nutritionPreferences")}
          </label>
          <select
            id="nutritionPreferences"
            value={values.nutritionPreferences || ""}
            onChange={(e) => setValues(prev => ({ ...prev, nutritionPreferences: e.target.value }))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="">{t("common.select")}</option>
            <option value="none">{t("profile.none")}</option>
            <option value="omnivore">{t("profile.omnivore")}</option>
            <option value="vegetarian">{t("profile.vegetarian")}</option>
            <option value="vegan">{t("profile.vegan")}</option>
            <option value="pescatarian">{t("profile.pescatarian")}</option>
            <option value="flexitarian">{t("profile.flexitarian")}</option>
            <option value="glutenFree">{t("profile.glutenFree")}</option>
            <option value="dairyFree">{t("profile.dairyFree")}</option>
            <option value="nutFree">{t("profile.nutFree")}</option>
            <option value="halal">{t("profile.halal")}</option>
            <option value="kosher">{t("profile.kosher")}</option>
            <option value="paleo">{t("profile.paleo")}</option>
            <option value="keto">{t("profile.keto")}</option>
            <option value="mediterranean">{t("profile.mediterranean")}</option>
            <option value="other">{t("profile.other")}</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            {t("profile.nutritionHelp")}
          </p>
        </div>

        {/* Health Info */}
        <div>
          <label htmlFor="healthInfo" className="block text-sm font-medium text-gray-700">
            {t("profile.healthInfo")}
          </label>
          <textarea
            id="healthInfo"
            rows="3"
            value={values.healthInfo || ""}
            onChange={(e) => setValues(prev => ({ ...prev, healthInfo: e.target.value }))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            placeholder={t("profile.healthPlaceholder")}
          />
        </div>
      </div>

      {/* Goals & Looking For */}
      <FormGoalSummary
        summary={values.summary}
        setSummary={(v) => setValues(prev => ({ ...prev, summary: v }))}
        goal={values.goal}
        setGoal={(v) => setValues(prev => ({ ...prev, goal: v }))}
        t={t}
      />
      <FormLookingFor
        lookingFor={values.lookingFor}
        setLookingFor={(v) => setValues(prev => ({ ...prev, lookingFor: v }))}
        t={t}
      />

      {/* Add / Remove extra photos */}
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

      {/* Save changes */}
      <button
        type="submit"
        className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        💾 {t("profile.saveChanges")}
      </button>

      {/* Delete account */}
      <button
        type="button"
        className="w-full mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        onClick={async () => {
          if (!window.confirm(t("profile.confirmDelete"))) return;
          try {
            await axios.delete(`${BACKEND_BASE_URL}/api/users/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            window.location.href = "/";
          } catch (err) {
            console.error(err);
            alert(t("profile.deleteFailed"));
          }
        }}
      >
        🗑️ {t("profile.deleteAccount")}
      </button>

      {/* Admin-only: hide/unhide user */}
      {user.isAdmin && (
        <button
          type="button"
          className="w-full mt-2 px-6 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600"
          onClick={async () => {
            try {
              const res = await axios.put(
                `${BACKEND_BASE_URL}/api/users/admin/hide/${user._id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              alert(res.data.message);
            } catch (err) {
              console.error(err);
              alert("Piilotus epäonnistui");
            }
          }}
        >
          👁️ {user.hidden ? t("profile.unhideUser") : t("profile.hideUser")}
        </button>
      )}

      {/* Feedback message */}
      {message && (
        <p className={`text-center ${success ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default ProfileForm;
