
// src/components/profileFields/ProfileForm.jsx

import React, { useState, useEffect, useMemo } from "react";
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
const professionCategories = [
  "Administration",
  "Finance",
  "Military",
  "Technical",
  "Healthcare",
  "Education",
  "Entrepreneur",
  "Law",
  "Farmer/Forest worker",
  "Theologian/Priest",
  "Service",
  "Artist",
  "DivineServant",
  "Homeparent",
  "FoodIndustry",
  "Retail",
  "Arts",
  "Government",
  "Retired",
  "Athlete",
  "Other",
];

const dietOptions = [
  "none",
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "flexitarian",
  "keto",
  "other",
];

const schema = yup.object().shape({
  // required fields
  username: yup.string().required("Required"),
  email: yup.string().email("Invalid email").required("Required"),
  age: yup
    .number()
    .typeError("Age must be a number")
    .min(18, "Must be at least 18")
    .required("Required"),
  gender: yup.string().required("Required"),
  orientation: yup.string().required("Required"),

  // optional text fields
  country: yup.string(),
  region: yup.string(),
  city: yup.string(),
  customCountry: yup.string(),
  customRegion: yup.string(),
  customCity: yup.string(),
  education: yup.string(),

  // profession category must match front-end options
  professionCategory: yup
    .string()
    .oneOf(["", ...professionCategories], "Invalid profession category"),
  profession: yup.string().required("Required"),

  // other optional selects
  religion: yup.string(),
  religionImportance: yup.string(),
  children: yup.string(),
  pets: yup.string(),
  smoke: yup.string(),
  drink: yup.string(),
  drugs: yup.string(),

  // numeric with empty string transform
  height: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),
  heightUnit: yup.string().oneOf(["", "Cm", "FtIn"], "Invalid unit"),
  weight: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),

  bodyType: yup.string(),
  activityLevel: yup.string(),

  nutritionPreferences: yup
    .string()
    .oneOf(["", ...dietOptions], "Invalid diet"),
  healthInfo: yup.string(),

  // free text
  summary: yup.string(),
  goal: yup.string(),
  lookingFor: yup.string(),

  // coordinates
  latitude: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),
  longitude: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),

  extraImages: yup.array().of(yup.string()),
});

export default function ProfileForm({
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
}) {
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
      professionCategory: user.professionCategory || "",
      profession: user.profession || "",
      religion: user.religion || "",
      religionImportance: user.religionImportance || "",
      children: user.children || "",
      pets: user.pets || "",
      smoke: user.smoke || "",
      drink: user.drink || "",
      drugs: user.drugs || "",
      height: user.height ?? null,
      heightUnit: user.heightUnit || "",
      weight: user.weight ?? null,
      bodyType: user.bodyType || "",
      activityLevel: user.activityLevel || "",
      nutritionPreferences: Array.isArray(user.nutritionPreferences)
        ? user.nutritionPreferences[0]
        : user.nutritionPreferences || "",
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

  // sync updates
  useEffect(() => {
    reset({ ...getValues(), ...user, extraImages: user.extraImages || [] });
  }, [user, reset, getValues]);

  // avatar and extra images
  const [localExtraImages, setLocalExtraImages] = useState(user.extraImages || []);
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

  const handleAvatarChange = (e) => {
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSubmit = async () => {
    if (!avatarFile || !userId) return;
    try {
      const updated = await uploadAvatar(userId, avatarFile);
      onUserUpdate(updated);
    } catch (err) {
      setAvatarError(err.message || t("profile.uploadAvatarFailed"));
    }
  };

  const onFormSubmit = async (data) => {
    const payload = {
      ...data,
      nutritionPreferences: data.nutritionPreferences ? [data.nutritionPreferences] : [],
      extraImages: localExtraImages,
    };
    await onSubmitProp(payload);
  };

  const slideshowImages = useMemo(() => {
    const arr = [];
    if (avatarPreview) arr.push(avatarPreview);
    localExtraImages.forEach((src) => {
      arr.push(
        typeof src === "string" && !src.startsWith("http")
          ? `${BACKEND_BASE_URL}${src}`
          : src
      );
    });
    return arr;
  }, [avatarPreview, localExtraImages]);

  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      if (slideshowImages.length > 1) {
        setSlideIndex((i) => (i + 1) % slideshowImages.length);
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [slideshowImages]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onFormSubmit)} className="bg-white shadow rounded-lg p-6 space-y-6" data-cy="ProfileForm__form">
        {/* Avatar carousel */}
        {!hideAvatarSection && slideshowImages.length > 0 && (
          <div className="flex flex-col items-center space-y-4">
            <img
              src={slideshowImages[slideIndex]}
              alt={`Avatar ${slideIndex + 1}`}
              className="w-32 h-32 rounded-full object-cover cursor-pointer"
              onMouseEnter={() => setSlideIndex((i) => (i + 1) % slideshowImages.length)}
            />
            <div className="flex items-center space-x-2">
              <label htmlFor="avatar-input" className="px-4 py-2 bg-gray-200 border rounded cursor-pointer">
                {avatarFile ? avatarFile.name : t("profile.browse")}
              </label>
              <input id="avatar-input" type="file" className="hidden" onChange={handleAvatarChange} />
              <span className="text-sm text-gray-500">
                {avatarFile ? "" : t("profile.noFileChosen")}
              </span>
            </div>
            <button type="button" onClick={handleAvatarSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">
              {t("profile.uploadAvatar")}
            </button>
            {avatarError && <p className="text-red-600">{avatarError}</p>}
          </div>
        )}

        {/* Basic Info */}
        <FormBasicInfo t={t} errors={errors} />
        {/* Location */}
        <FormLocation t={t} errors={errors} countryFieldName="country" regionFieldName="region" cityFieldName="city" customCountryFieldName="customCountry" customRegionFieldName="customRegion" customCityFieldName="customCity" />
        {/* Education */}
        <FormEducation t={t} />
        {/* Profession + Religion */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("profile.professionCategory")}</label>
            <select {...methods.register("professionCategory")} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">{t("common.select")}</option>
              {professionCategories.map((opt) => (
                <option key={opt} value={opt}>{t(`profile.professionCategory.${opt}`) || opt}</option>
              ))}
            </select>
            {errors.professionCategory && <p className="mt-1 text-red-600">{errors.professionCategory.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">💼 {t("profile.profession")}</label>
            <input type="text" {...methods.register("profession")} className="w-full border rounded px-3 py-2 text-sm" placeholder={t("profile.professionPlaceholder")} />
            {errors.profession && <p className="mt-1 text-red-600">{errors.profession.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">🕊 {t("profile.religion")}</label>
            <select {...methods.register("religion")} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">{t("common.select")}</option>
              <option value="Christianity">{t("religion.christianity")}</option>
              <option value="Islam">{t("religion.islam")}</option>
              <option value="Hinduism">{t("religion.hinduism")}</option>
              <option value="Buddhism">{t("religion.buddhism")}</option>
              <option value="Folk">{t("religion.folk")}</option>
              <option value="None">{t("religion.none")}</option>
              <option value="Other">{t("common.other")}</option>
            </select>
            {errors.religion && <p className="mt-1 text-red-600">{errors.religion.message}</p>}
          </div>
        </div>
        {/* Children & Pets */}
        <FormChildrenPets t={t} errors={errors} />
        {/* Lifestyle */}
        <FormLifestyle t={t} includeAllOption />
        {/* Goal & Summary */}
        <FormGoalSummary t={t} errors={errors} />
        {/* Looking For */}
        <FormLookingFor t={t} errors={errors} />
        {/* Photo Uploader */}
        {!hidePhotoSection && userId && <MultiStepPhotoUploader data-cy="ProfileForm__photoUploader" userId={userId} isPremium={isPremium} extraImages={localExtraImages} onSuccess={(res) => { setLocalExtraImages(res.extraImages || []); onUserUpdate({ ...user, extraImages: res.extraImages || [] }); }} onError={(err) => console.error(err)} />}
        {/* Save */}
        <div className="flex justify-end"><button type="submit" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">{t("profile.save")}</button></div>
        {/* Status */}
        {success && <p className="text-center text-green-600">{t("profile.saveSuccess")}</p>}
        {!success && message && <p className="text-center text-red-600">{message}</p>}
      </form>
    </FormProvider>
  );
}



