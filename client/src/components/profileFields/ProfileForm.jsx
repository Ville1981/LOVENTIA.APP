// src/components/profileFields/ProfileForm.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
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

// =============================================
// Validation schema
// =============================================
const schema = yup.object().shape({
  username: yup.string().required("Required field"),
  email: yup.string().email("Invalid email address").required("Required field"),
  age: yup.number().typeError("Age must be a number").required("Required field"),
  gender: yup.string().required("Required field"),
  orientation: yup.string().required("Required field"),
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
  height: yup
    .number()
    .nullable()
    .transform((v, ov) => (ov === "" ? null : v)),
  weight: yup
    .number()
    .nullable()
    .transform((v, ov) => (ov === "" ? null : v)),
  bodyType: yup.string(),
  activityLevel: yup.string(),
  nutritionPreferences: yup.array().of(yup.string()),
  healthInfo: yup.string(),
  summary: yup.string(),
  goal: yup.string(),
  lookingFor: yup.string(),
  latitude: yup
    .number()
    .nullable()
    .transform((v, ov) => (ov === "" ? null : v)),
  longitude: yup
    .number()
    .nullable()
    .transform((v, ov) => (ov === "" ? null : v)),
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
  hidePhotoSection = false,
}) => {
  // React Hook Form setup
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
      height: user.height ?? null,
      weight: user.weight ?? null,
      bodyType: user.bodyType || "",
      activityLevel: user.activityLevel || "",
      nutritionPreferences: user.nutritionPreferences || [],
      healthInfo: user.healthInfo || "",
      summary: user.summary || "",
      goal: user.goal || "",
      lookingFor: user.lookingFor || "",
      latitude: user.latitude ?? null,
      longitude: user.longitude ?? null,
      extraImages: user.extraImages || [],
    },
  });

  const {
    handleSubmit,
    reset,
    formState: { errors },
    getValues,
  } = methods;

  // reset on user change
  useEffect(() => {
    reset({ ...getValues(), ...user, extraImages: user.extraImages || [] });
  }, [user, reset, getValues]);

  // Local state: extra images & avatar
  const [localExtraImages, setLocalExtraImages] = useState(
    user.extraImages || []
  );
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
    setAvatarPreview(
      user.profilePicture
        ? user.profilePicture.startsWith("http")
          ? user.profilePicture
          : `${BACKEND_BASE_URL}${user.profilePicture}`
        : null
    );
  }, [user.profilePicture]);

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
    if (!avatarFile || !userId) return;
    try {
      const updatedUser = await uploadAvatar(userId, avatarFile);
      onUserUpdate(updatedUser);
    } catch (err) {
      setAvatarError(err.message || t("profile.avatarUploadFailed"));
    }
  };

  const onFormSubmit = async (data) => {
    const payload = { ...data, extraImages: localExtraImages };
    try {
      await onSubmitProp(payload);
      alert("Profile saved successfully!");
    } catch {
      alert("Failed to save profile. Please try again.");
    }
  };

  // Carousel logic
  const [slideIndex, setSlideIndex] = useState(0);
  const intervalRef = useRef(null);

  const slideshowImages = useMemo(() => {
    const arr = [];
    if (avatarPreview) arr.push(avatarPreview);
    localExtraImages.forEach((src) => {
      const full =
        typeof src === "string" && !src.startsWith("http")
          ? `${BACKEND_BASE_URL}${src}`
          : src;
      arr.push(full);
    });
    return arr;
  }, [avatarPreview, localExtraImages]);

  const startSlideshow = () => {
    clearInterval(intervalRef.current);
    if (slideshowImages.length < 2) return;
    intervalRef.current = setInterval(
      () => setSlideIndex((i) => (i + 1) % slideshowImages.length),
      3000
    );
  };
  const stopSlideshow = () => {
    clearInterval(intervalRef.current);
    setSlideIndex(0);
  };
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);
    return (
    <FormProvider {...methods}>
      <form
        data-cy="ProfileForm__form"
        onSubmit={handleSubmit(onFormSubmit)}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        {/* Avatar-osio */}
        {!hideAvatarSection && (
          <div className="flex flex-col items-center space-y-6">
            <div
              className="relative inline-block w-64 h-64 rounded-full overflow-hidden border-4 border-blue-500 mx-auto cursor-pointer"
              onMouseEnter={startSlideshow}
              onMouseLeave={stopSlideshow}
            >
              <img
                data-cy="ProfileForm__avatarPreview"
                src={slideshowImages[slideIndex]}
                alt="Profile"
                className="w-full h-full object-cover object-center"
                onError={(e) =>
                  (e.currentTarget.src = "/placeholder-avatar-male.png")
                }
              />
              <Link
                to="/profile/photos"
                className="absolute inset-0 flex items-center justify-center bg-blue-600 bg-opacity-90 px-6 py-2 text-white text-lg font-semibold rounded"
                aria-label="Manage Photos"
              >
                ADD
              </Link>
            </div>

            <div className="flex space-x-4">
              <label className="px-4 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700">
                Add Avatar
                <input
                  data-cy="ProfileForm__avatarInput"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
              <button
                data-cy="ProfileForm__avatarSaveButton"
                type="button"
                onClick={handleAvatarSubmit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                🎨 Save changes
              </button>
            </div>
            {avatarError && <p className="text-red-600">{avatarError}</p>}
          </div>
        )}

        {/* Muut lomakekentät */}
        <FormBasicInfo t={t} errors={errors} />
        <FormLocation
          t={t}
          errors={errors}
          countryFieldName="country"
          regionFieldName="region"
          cityFieldName="city"
          customCountryFieldName="customCountry"
          customRegionFieldName="customRegion"
          customCityFieldName="customCity"
          includeAllOption={true}
        />
        <FormEducation t={t} errors={errors} />
        <FormChildrenPets t={t} errors={errors} />
        <FormLifestyle t={t} errors={errors} />
        <FormGoalSummary t={t} errors={errors} />
        <FormLookingFor t={t} errors={errors} />

        {/* Extra-kuvien uploader */}
        {!hidePhotoSection && userId && (
          <MultiStepPhotoUploader
            data-cy="ProfileForm__photoUploader"
            userId={userId}
            isPremium={isPremium}
            extraImages={localExtraImages}
            onSuccess={(res) => {
              const newImgs = res.extraImages || [];
              setLocalExtraImages(newImgs);
              onUserUpdate({ ...user, extraImages: newImgs });
            }}
            onError={(err) => console.error("Photo uploader error:", err)}
          />
        )}

        {/* Save & Delete */}
        <button
          data-cy="ProfileForm__saveButton"
          type="submit"
          className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          💾 Save changes
        </button>
        <button
          data-cy="ProfileForm__deleteButton"
          type="button"
          className="w-full mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          onClick={async () => {
            if (!window.confirm(t("profile.confirmDelete"))) return;
            try {
              const token = localStorage.getItem("token");
              await axios.delete(`${BACKEND_BASE_URL}/api/users/profile`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              window.location.href = "/";
            } catch (err) {
              console.error(err);
              alert("Failed to delete account.");
            }
          }}
        >
          🗑️ {t("profile.deleteAccount")}
        </button>

        {/* Admin toggle */}
        {user.isAdmin && (
          <button
            data-cy="ProfileForm__adminToggleButton"
            type="button"
            className="w-full mt-2 px-6 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600"
            onClick={async () => {
              try {
                const token = localStorage.getItem("token");
                const res = await axios.put(
                  `${BACKEND_BASE_URL}/api/users/admin/hide/${userId}`,
                  {},
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                alert(res.data.message);
              } catch {
                alert("Failed to toggle visibility.");
              }
            }}
          >
            👁️ {user.hidden ? t("profile.unhideUser") : t("profile.hideUser")}
          </button>
        )}

        {/* Inline‐viestit */}
        {success ? (
          <p className="text-center text-green-600">
            Profile saved successfully!
          </p>
        ) : message ? (
          <p className="text-center text-red-600">Error saving profile.</p>
        ) : null}
      </form>
    </FormProvider>
  );
};

export default ProfileForm;




