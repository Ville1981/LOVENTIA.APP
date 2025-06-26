import React, { useState, useEffect } from "react";
import axios from "axios";
import FormBasicInfo from "./FormBasicInfo";
import FormLocation from "./FormLocation";
import FormEducation from "./FormEducation";
import FormChildrenPets from "./FormChildrenPets";
import FormGoalSummary from "./FormGoalSummary";
import FormLookingFor from "./FormLookingFor";
import FormLifestyle from "./FormLifestyle"; // ✅ Lisätty
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
  const [localExtraImages, setLocalExtraImages] = useState(user.extraImages || []);
  useEffect(() => {
    setLocalExtraImages(user.extraImages || []);
  }, [user.extraImages]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 🔥 Debug: tulostetaan payload konsoliin
    console.log("📤 Lähetettävä payload:", values);

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

      <FormLocation
        country={values.country}
        region={values.region}
        city={values.city}
        customCountry={values.customCountry}
        customRegion={values.customRegion}
        customCity={values.customCity}
        setCountry={(v) => setValues((prev) => ({ ...prev, country: v }))}
        setRegion={(v) => setValues((prev) => ({ ...prev, region: v }))}
        setCity={(v) => setValues((prev) => ({ ...prev, city: v }))}
        setCustomCountry={(v) => setValues((prev) => ({ ...prev, customCountry: v }))}
        setCustomRegion={(v) => setValues((prev) => ({ ...prev, customRegion: v }))}
        setCustomCity={(v) => setValues((prev) => ({ ...prev, customCity: v }))}
        t={t}
      />

      <FormEducation
        education={values.education}
        setEducation={(v) => setValues((prev) => ({ ...prev, education: v }))}
        profession={values.profession}
        setProfession={(v) => setValues((prev) => ({ ...prev, profession: v }))}
        religion={values.religion}
        setReligion={(v) => setValues((prev) => ({ ...prev, religion: v }))}
        religionImportance={values.religionImportance}
        setReligionImportance={(v) =>
          setValues((prev) => ({ ...prev, religionImportance: v }))
        }
        t={t}
      />

      <FormChildrenPets
        children={values.children}
        setChildren={(v) => setValues((prev) => ({ ...prev, children: v }))}
        pets={values.pets}
        setPets={(v) => setValues((prev) => ({ ...prev, pets: v }))}
        t={t}
      />

      {/* ✅ UUSI LIFESTYLE-OSIO */}
      <FormLifestyle
        smoke={values.smoke}
        setSmoke={(v) => setValues((prev) => ({ ...prev, smoke: v }))}
        drink={values.drink}
        setDrink={(v) => setValues((prev) => ({ ...prev, drink: v }))}
        drugs={values.drugs}
        setDrugs={(v) => setValues((prev) => ({ ...prev, drugs: v }))}
        t={t}
      />

      {/* ✅ UUSI METRICS-OSIO */}
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
              onChange={(e) =>
                setValues((prev) => ({ ...prev, height: e.target.value }))
              }
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
              onChange={(e) =>
                setValues((prev) => ({ ...prev, weight: e.target.value }))
              }
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
              value={values.bodyType || "normal"}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, bodyType: e.target.value }))
              }
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            >
              <option value="slim">{t("profile.slim")}</option>
              <option value="normal">{t("profile.normal")}</option>
              <option value="athletic">{t("profile.athletic")}</option>
              <option value="overweight">{t("profile.overweight")}</option>
              <option value="obese">{t("profile.obese")}</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="activityLevel"
              className="block text-sm font-medium text-gray-700"
            >
              {t("profile.activityLevel")}
            </label>
            <select
              id="activityLevel"
              value={values.activityLevel || "sedentary"}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, activityLevel: e.target.value }))
              }
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            >
              <option value="sedentary">{t("profile.sedentary")}</option>
              <option value="light">{t("profile.light")}</option>
              <option value="moderate">{t("profile.moderate")}</option>
              <option value="active">{t("profile.active")}</option>
              <option value="very active">{t("profile.veryActive")}</option>
            </select>
          </div>
        </div>

        {/* Nutrition Preferences */}
        <div>
          <label
            htmlFor="nutritionPreferences"
            className="block text-sm font-medium text-gray-700"
          >
            {t("profile.nutritionPreferences")}
          </label>
          <select
            id="nutritionPreferences"
            multiple
            value={values.nutritionPreferences || []}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
              setValues((prev) => ({ ...prev, nutritionPreferences: opts }));
            }}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="none">{t("profile.none")}</option>
            <option value="omnivore">{t("profile.omnivore")}</option>
            <option value="vegetarian">{t("profile.vegetarian")}</option>
            <option value="vegan">{t("profile.vegan")}</option>
            <option value="pescatarian">{t("profile.pescatarian")}</option>
            <option value="flexitarian">{t("profile.flexitarian")}</option>
            <option value="gluten-free">{t("profile.glutenFree")}</option>
            <option value="dairy-free">{t("profile.dairyFree")}</option>
            <option value="nut-free">{t("profile.nutFree")}</option>
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
            onChange={(e) =>
              setValues((prev) => ({ ...prev, healthInfo: e.target.value }))
            }
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            placeholder={t("profile.healthPlaceholder")}
          />
        </div>
      </div>
      {/* ✅ END OF METRICS-OSIO */}

      <FormGoalSummary
        summary={values.summary}
        setSummary={(v) => setValues((prev) => ({ ...prev, summary: v }))}
        goal={values.goal}
        setGoal={(v) => setValues((prev) => ({ ...prev, goal: v }))}
        t={t}
      />

      <FormLookingFor
        lookingFor={values.lookingFor}
        setLookingFor={(v) => setValues((prev) => ({ ...prev, lookingFor: v }))}
        t={t}
      />

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
