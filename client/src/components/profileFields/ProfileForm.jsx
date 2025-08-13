// --- REPLACE START: keep structure, add robust URL handling + safer uploader integration (no unnecessary shortening) ---
import { yupResolver } from "@hookform/resolvers/yup";
import React, { useState, useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Link } from "react-router-dom";
import * as yup from "yup";

import FormBasicInfo from "./FormBasicInfo";
import FormChildrenPets from "./FormChildrenPets";
import FormEducation from "./FormEducation";
import FormGoalSummary from "./FormGoalSummary";
import FormLifestyle from "./FormLifestyle";
import FormLocation from "./FormLocation";
import FormLookingFor from "./FormLookingFor";
import MultiStepPhotoUploader from "./MultiStepPhotoUploader";
import { BACKEND_BASE_URL } from "../../config";

// --- REPLACE START: path normalizer helper (keeps Windows paths safe) ---
/** Normalize Windows backslashes and ensure one leading slash */
const normalizePath = (p = "") =>
  "/" + String(p).replace(/\\/g, "/").replace(/^\/+/, "");
// --- REPLACE END ---

// =============================================
// Constants for selects
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

const religionOptions = [
  "",
  "Christianity",
  "Islam",
  "Hinduism",
  "Buddhism",
  "Folk",
  "None",
  "Other",
  "Atheism",
];

const religionImportanceOptions = [
  "",
  "Not at all important",
  "Somewhat important",
  "Very important",
  "Essential",
];

// =============================================
// Validation schema
// =============================================
const schema = yup.object().shape({
  username: yup.string().required("Required"),
  email: yup.string().email("Invalid email").required("Required"),
  age: yup
    .number()
    .typeError("Age must be a number")
    .min(18, "Must be at least 18")
    .required("Required"),
  gender: yup.string().required("Required"),
  orientation: yup.string().required("Required"),

  country: yup.string(),
  region: yup.string(),
  city: yup.string(),
  customCountry: yup.string(),
  customRegion: yup.string(),
  customCity: yup.string(),

  education: yup.string(),

  professionCategory: yup
    .string()
    .oneOf(["", ...professionCategories], "Invalid profession category"),
  profession: yup.string().required("Required"),

  religion: yup.string().oneOf(religionOptions, "Invalid religion"),
  religionImportance: yup
    .string()
    .oneOf(religionImportanceOptions, "Invalid importance"),

  children: yup.string(),
  pets: yup.string(),
  smoke: yup.string(),
  drink: yup.string(),
  drugs: yup.string(),

  height: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),
  heightUnit: yup.string().oneOf(["", "Cm", "FtIn"], "Invalid unit"),
  weight: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),
  bodyType: yup.string(),
  activityLevel: yup.string(),

  nutritionPreferences: yup
    .string()
    .oneOf(["", ...dietOptions], "Invalid diet"),
  healthInfo: yup.string(),

  summary: yup.string(),
  goal: yup.string(),
  lookingFor: yup.string(),

  profilePhoto: yup.string(),

  latitude: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),
  longitude: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),

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

      profilePhoto: user.profilePicture || "",

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

  // Keep form in sync with remote data & unwrap avatar
  useEffect(() => {
    reset({
      ...getValues(),
      ...user,
      nutritionPreferences: Array.isArray(user.nutritionPreferences)
        ? user.nutritionPreferences[0]
        : user.nutritionPreferences,
      extraImages: user.extraImages || [],
      profilePhoto: user.profilePicture || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reset]);

  // Local state for extra-images & avatar preview
  const [localExtraImages, setLocalExtraImages] = useState(
    user.extraImages || []
  );

  // --- REPLACE START: robust avatar URL normalization ---
  const [avatarPreview, setAvatarPreview] = useState(
    user.profilePicture
      ? user.profilePicture.startsWith("http")
        ? user.profilePicture
        : `${BACKEND_BASE_URL}${normalizePath(user.profilePicture)}`
      : null
  );

  useEffect(() => {
    if (user.profilePicture) {
      setAvatarPreview(
        user.profilePicture.startsWith("http")
          ? user.profilePicture
          : `${BACKEND_BASE_URL}${normalizePath(user.profilePicture)}`
      );
    } else {
      setAvatarPreview(null);
    }
  }, [user.profilePicture]);
  // --- REPLACE END ---

  // On form submit, wrap diet into array & include chosen profilePhoto
  const onFormSubmit = async (data) => {
    const payload = {
      ...data,
      nutritionPreferences: data.nutritionPreferences
        ? [data.nutritionPreferences]
        : [],
      extraImages: localExtraImages,
      profilePhoto: data.profilePhoto,
    };
    await onSubmitProp(payload);
  };

  // Build filtered slideshow array: avatar first, then extra images
  const slideshowImages = useMemo(() => {
    const arr = [];
    if (avatarPreview) arr.push(avatarPreview);
    (localExtraImages || []).forEach((src) => {
      if (!src) return;
      const s =
        typeof src === "string" && !src.startsWith("http")
          ? `${BACKEND_BASE_URL}${normalizePath(src)}`
          : src;
      arr.push(s);
    });
    return arr.filter(Boolean);
  }, [avatarPreview, localExtraImages]);

  // Reset slide index to 0 whenever the number of slideshow images changes
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    setSlideIndex(0);
  }, [slideshowImages.length]);

  // Auto-advance slideshow every 3s if more than one image
  useEffect(() => {
    if (slideshowImages.length < 2) return;
    const iv = setInterval(() => {
      setSlideIndex((i) => (i + 1) % slideshowImages.length);
    }, 3000);
    return () => clearInterval(iv);
  }, [slideshowImages]);

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        className="bg-white shadow rounded-lg p-6 space-y-6"
        data-cy="ProfileForm__form"
      >
        {/* Hidden field so backend always sees profilePhoto */}
        <input type="hidden" {...methods.register("profilePhoto")} />

        {/* Avatar slideshow + Manage Photos link */}
        {!hideAvatarSection && slideshowImages.length > 0 && (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={slideshowImages[slideIndex]}
              alt={`Avatar ${slideIndex + 1}`}
              className="w-32 h-32 rounded-full object-cover cursor-pointer"
              onMouseEnter={() =>
                setSlideIndex((i) => (i + 1) % slideshowImages.length)
              }
            />
            <Link
              to="/profile/photos"
              className="mt-2 text-blue-600 hover:underline"
            >
              {t("profile.managePhotos") || "Manage Photos"}
            </Link>
          </div>
        )}

        {/* Basic Info */}
        <FormBasicInfo t={t} errors={errors} />

        {/* Location */}
        <FormLocation
          t={t}
          errors={errors}
          countryFieldName="country"
          regionFieldName="region"
          cityFieldName="city"
          customCountryFieldName="customCountry"
          customRegionFieldName="customRegion"
          customCityFieldName="customCity"
        />

        {/* Education */}
        <FormEducation t={t} />

        {/* Profession + Religion */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profession Category */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("profile.professionCategory")}
            </label>
            <select
              {...methods.register("professionCategory")}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">{t("common.select")}</option>
              {professionCategories.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`profile.professionCategory.${opt}`) || opt}
                </option>
              ))}
            </select>
            {errors.professionCategory && (
              <p className="mt-1 text-red-600">
                {errors.professionCategory.message}
              </p>
            )}
          </div>

          {/* Profession */}
          <div>
            <label className="block text-sm font-medium mb-1">
              💼 {t("profile.profession")}
            </label>
            <input
              type="text"
              {...methods.register("profession")}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={t("profile.professionPlaceholder")}
            />
            {errors.profession && (
              <p className="mt-1 text-red-600">{errors.profession.message}</p>
            )}
          </div>

          {/* Religion */}
          <div>
            <label className="block text-sm font-medium mb-1">
              🕊 {t("profile.religion")}
            </label>
            <select
              {...methods.register("religion")}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {religionOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt
                    ? t(`religion.${opt.toLowerCase()}`) || opt
                    : t("common.select")}
                </option>
              ))}
            </select>
            {errors.religion && (
              <p className="mt-1 text-red-600">{errors.religion.message}</p>
            )}
          </div>
        </div>

        {/* Religion importance */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("profile.religionImportance")}
          </label>
          <select
            {...methods.register("religionImportance")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {religionImportanceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt || t("common.select")}
              </option>
            ))}
          </select>
          {errors.religionImportance && (
            <p className="mt-1 text-red-600">
              {errors.religionImportance.message}
            </p>
          )}
        </div>

        {/* Children & Pets */}
        <FormChildrenPets t={t} errors={errors} />

        {/* Lifestyle */}
        <FormLifestyle t={t} includeAllOption />

        {/* Goals & Summary */}
        <FormGoalSummary
          t={t}
          errors={errors}
          fieldName="goal"
          summaryField="summary"
        />

        {/* Looking For */}
        <FormLookingFor t={t} errors={errors} fieldName="lookingFor" />

        {/* Extra Photo Uploader */}
        {!hidePhotoSection && userId && (
          <MultiStepPhotoUploader
            data-cy="ProfileForm__photoUploader"
            userId={userId}
            isPremium={isPremium}
            extraImages={localExtraImages}
            // --- REPLACE START: handle both shapes (array or {extraImages}) from uploader ---
            onSuccess={(payload) => {
              const updated = Array.isArray(payload)
                ? payload
                : payload?.extraImages || payload || [];
              setLocalExtraImages(updated);
              onUserUpdate({ ...user, extraImages: updated });
            }}
            // --- REPLACE END ---
            onError={(err) => console.error(err)}
          />
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {t("profile.save")}
          </button>
        </div>

        {/* Status */}
        {success && (
          <p className="text-center text-green-600">
            {t("profile.saveSuccess")}
          </p>
        )}
        {!success && message && (
          <p className="text-center text-red-600">{message}</p>
        )}
      </form>
    </FormProvider>
  );
}
// --- REPLACE END ---
