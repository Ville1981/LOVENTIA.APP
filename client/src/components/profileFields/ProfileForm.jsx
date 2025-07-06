import React, { useState, useEffect } from "react";
import axios from "axios";
import { useForm, FormProvider } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
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

// Yup-skeema validointiin
const schema = yup.object().shape({
  username: yup.string().required("Pakollinen kenttä"),
  email: yup.string().email("Virheellinen sähköposti").required("Pakollinen kenttä"),
  age: yup.number().required("Pakollinen kenttä"),
  gender: yup.string().required("Pakollinen kenttä"),
  orientation: yup.string().required("Pakollinen kenttä"),
  country: yup.string(),
  region: yup.string(),
  city: yup.string(),
  customCountry: yup.string(),
  customRegion: yup.string(),
  customCity: yup.string(),
  education: yup.string(),
  profession: yup.string(),
  religion: yup.string(),
  religionImportance: yup.string(),
  children: yup.string(),
  pets: yup.string(),
  smoke: yup.string(),
  drink: yup.string(),
  drugs: yup.string(),
  height: yup.number(),
  weight: yup.number(),
  bodyType: yup.string(),
  activityLevel: yup.string(),
  nutritionPreferences: yup.array().of(yup.string()),
  healthInfo: yup.string(),
  summary: yup.string(),
  goal: yup.string(),
  lookingFor: yup.string(),
  latitude: yup.number(),
  longitude: yup.number(),
});

const ProfileForm = ({
  userId,
  user,
  isPremium,
  t,
  message,
  success,
  onUserUpdate,
  onSubmit: onSubmitProp,
  hideAvatarSection = false,
}) => {
  const methods = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      username: user.username || "",
      email: user.email || "",
      age: user.age || "",
      gender: user.gender || "",
      orientation: user.orientation || "",
      country: user.country || "",
      region: user.region || "",
      city: user.city || "",
      customCountry: user.customCountry || "",
      customRegion: user.customRegion || "",
      customCity: user.customCity || "",
      education: user.education || "",
      profession: user.profession || "",
      religion: user.religion || "",
      religionImportance: user.religionImportance || "",
      children: user.children || "",
      pets: user.pets || "",
      smoke: user.smoke || "",
      drink: user.drink || "",
      drugs: user.drugs || "",
      height: user.height || "",
      weight: user.weight || "",
      bodyType: user.bodyType || "",
      activityLevel: user.activityLevel || "",
      nutritionPreferences: user.nutritionPreferences || [],
      healthInfo: user.healthInfo || "",
      summary: user.summary || "",
      goal: user.goal || "",
      lookingFor: user.lookingFor || "",
      latitude: user.latitude || null,
      longitude: user.longitude || null,
    },
  });

  const {
    handleSubmit,
    reset,
    formState: { errors },
    getValues,
  } = methods;

  // Päivitä lomake, kun user-prop muuttuu
  useEffect(() => {
    reset({
      ...getValues(),
      username: user.username,
      email: user.email,
      age: user.age,
      gender: user.gender,
      orientation: user.orientation,
      country: user.country,
      region: user.region,
      city: user.city,
      customCountry: user.customCountry,
      customRegion: user.customRegion,
      customCity: user.customCity,
      education: user.education,
      profession: user.profession,
      religion: user.religion,
      religionImportance: user.religionImportance,
      children: user.children,
      pets: user.pets,
      smoke: user.smoke,
      drink: user.drink,
      drugs: user.drugs,
      height: user.height,
      weight: user.weight,
      bodyType: user.bodyType,
      activityLevel: user.activityLevel,
      nutritionPreferences: user.nutritionPreferences,
      healthInfo: user.healthInfo,
      summary: user.summary,
      goal: user.goal,
      lookingFor: user.lookingFor,
      latitude: user.latitude,
      longitude: user.longitude,
    });
  }, [user, reset, getValues]);

  // Extra images state
  const [localExtraImages, setLocalExtraImages] = useState(
    user.extraImages || []
  );
  useEffect(() => {
    setLocalExtraImages(user.extraImages || []);
  }, [user.extraImages]);

  // Avatar
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user.profilePicture
      ? user.profilePicture.startsWith("http")
        ? user.profilePicture
        : `${BACKEND_BASE_URL}${user.profilePicture}`
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
    if (!userId) {
      console.error("uploadAvatar: userId is undefined!");
      setAvatarError(t("profile.avatarUploadFailed"));
      return;
    }
    setAvatarError(null);
    try {
      const updatedUser = await uploadAvatar(userId, avatarFile);
      if (updatedUser.profilePicture) {
        setAvatarPreview(
          updatedUser.profilePicture.startsWith("http")
            ? updatedUser.profilePicture
            : `${BACKEND_BASE_URL}${updatedUser.profilePicture}`
        );
      }
      onUserUpdate(updatedUser);
    } catch (err) {
      setAvatarError(err.message || t("profile.avatarUploadFailed"));
    }
  };

  // Lomakkeen lähetys
  const onFormSubmit = async (data) => {
    const payload = { ...data, extraImages: localExtraImages };
    try {
      await onSubmitProp(payload);
    } catch (err) {
      console.error("Profile save failed:", err);
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        data-cy="ProfileForm__form"
        onSubmit={handleSubmit(onFormSubmit)}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        {/* Avatar section */}
        {!hideAvatarSection && (
          <div
            className="flex flex-col items-center space-y-4"
            data-cy="ProfileForm__avatarSection"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border mx-auto">
              {avatarPreview && (
                <img
                  data-cy="ProfileForm__avatarPreview"
                  src={avatarPreview}
                  alt="Profile"
                  className="w-full h-full object-cover object-center"
                  onError={(e) => {
                    e.currentTarget.src =
                      "/placeholder-avatar-male.png";
                  }}
                />
              )}
            </div>
            <div className="flex space-x-4">
              <input
                data-cy="ProfileForm__avatarInput"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="block"
              />
              <button
                data-cy="ProfileForm__avatarSaveButton"
                type="button"
                onClick={handleAvatarSubmit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                🎨 {t("profile.saveAvatar")}
              </button>
            </div>
            {avatarError && (
              <p
                data-cy="ProfileForm__avatarError"
                className="text-red-600"
              >
                {avatarError}
              </p>
            )}
          </div>
        )}

        {/* Lomakeosiot RHF:n kautta */}
        <FormBasicInfo t={t} />
        <FormLocation t={t} />
        <FormEducation t={t} />
        <FormChildrenPets t={t} />
        <FormLifestyle t={t} />
        <FormGoalSummary t={t} />
        <FormLookingFor t={t} />

        {/* Photo Uploader */}
        <MultiStepPhotoUploader
          data-cy="ProfileForm__photoUploader"
          userId={userId}
          isPremium={isPremium}
          extraImages={localExtraImages}
          onSuccess={(res) => {
            setLocalExtraImages(res.extraImages || []);
            onUserUpdate({ ...user, extraImages: res.extraImages });
          }}
          onError={(err) =>
            console.error("Photo uploader error:", err)
          }
        />

        {/* Lähetä */}
        <button
          data-cy="ProfileForm__saveButton"
          type="submit"
          className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          💾 {t("profile.saveChanges")}
        </button>

        {/* Poista tili */}
        <button
          data-cy="ProfileForm__deleteButton"
          type="button"
          className="w-full mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          onClick={async () => {
            if (!window.confirm(t("profile.confirmDelete")))
              return;
            try {
              const token =
                localStorage.getItem("token");
              await axios.delete(
                `${BACKEND_BASE_URL}/api/users/profile`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              window.location.href = "/";
            } catch (err) {
              console.error(err);
              alert(t("profile.deleteFailed"));
            }
          }}
        >
          🗑️ {t("profile.deleteAccount")}
        </button>

        {/* Admin: piilota / näytä */}
        {user.isAdmin && (
          <button
            data-cy="ProfileForm__adminToggleButton"
            type="button"
            className="w-full mt-2 px-6 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600"
            onClick={async () => {
              try {
                const token =
                  localStorage.getItem("token");
                const res = await axios.put(
                  `${BACKEND_BASE_URL}/api/users/admin/hide/${userId}`,
                  {},
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );
                alert(res.data.message);
              } catch (err) {
                console.error(err);
                alert(t("profile.hideFailed"));
              }
            }}
          >
            👁️ {user.hidden ? t("profile.unhideUser") : t("profile.hideUser")}
          </button>
        )}

        {/* Viestit */}
        {message && (
          <p
            data-cy="ProfileForm__message"
            className={`text-center ${
              success ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </FormProvider>
  );
};

export default ProfileForm;
