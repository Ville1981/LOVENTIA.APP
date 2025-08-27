// --- REPLACE START: keep structure, add Political Ideology field (validate lowercase units + normalize on submit + preserve edits on reset + debug) ---
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

// --- REPLACE START: add i18n debug import (safe in dev only) ---
import i18next from "i18next";
// --- REPLACE END ---

// Normalize Windows backslashes and ensure one leading slash
const normalizePath = (p = "") =>
  "/" + String(p).replace(/\\/g, "/").replace(/^\/+/, "");

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

// --- REPLACE START: add key maps so we can translate reliably even with spaces/camelCase ---
const PROF_KEY_BY_LABEL = {
  Administration: "administration",
  Finance: "finance",
  Military: "military",
  Technical: "technical",
  Healthcare: "healthcare",
  Education: "education",
  Entrepreneur: "entrepreneur",
  Law: "law",
  "Farmer/Forest worker": "farmerForestWorker",
  "Theologian/Priest": "theologianPriest",
  Service: "service",
  Artist: "artist",
  DivineServant: "divineServant",
  Homeparent: "homeparent",
  FoodIndustry: "foodIndustry",
  Retail: "retail",
  Arts: "arts",
  Government: "government",
  Retired: "retired",
  Athlete: "athlete",
  Other: "other",
};

const POL_KEY_BY_LABEL = {
  Left: "left",
  Centre: "centre",
  Right: "right",
  Conservatism: "conservatism",
  Liberalism: "liberalism",
  Socialism: "socialism",
  Communism: "communism",
  Fascism: "fascism",
  Environmentalism: "environmentalism",
  Anarchism: "anarchism",
  Nationalism: "nationalism",
  Populism: "populism",
  Progressivism: "progressivism",
  Libertarianism: "libertarianism",
  Democracy: "democracy",
  Other: "other",
};
// --- REPLACE END ---

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

// New: Political ideology options
const politicalIdeologyOptions = [
  "",
  "Left",
  "Centre",
  "Right",
  "Conservatism",
  "Liberalism",
  "Socialism",
  "Communism",
  "Fascism",
  "Environmentalism",
  "Anarchism",
  "Nationalism",
  "Populism",
  "Progressivism",
  "Libertarianism",
  "Democracy",
  "Other",
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

  // New: Political ideology
  politicalIdeology: yup
    .string()
    .oneOf(politicalIdeologyOptions, "Invalid political ideology"),

  children: yup.string(),
  pets: yup.string(),
  smoke: yup.string(),
  drink: yup.string(),
  drugs: yup.string(),

  height: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),

  // Accept both title- and lowercase; we normalize on submit
  heightUnit: yup
    .string()
    .oneOf(["", "Cm", "FtIn", "cm", "ftin"], "Invalid unit"),

  weight: yup.number().nullable().transform((v, o) => (o === "" ? null : v)),
  weightUnit: yup
    .string()
    .oneOf(["", "kg", "lb", "KG", "LB"], "Invalid unit"),

  bodyType: yup.string(),
  activityLevel: yup.string(),

  nutritionPreferences: yup.string().oneOf(["", ...dietOptions], "Invalid diet"),
  healthInfo: yup.string(),

  summary: yup.string(),
  goal: yup.string(),
  lookingFor: yup.string(),

  profilePhoto: yup.string(),

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
  // --- REPLACE START: i18n debug block for Profession category & Political ideology ---
  if (process.env.NODE_ENV !== "production") {
    try {
      console.group("[i18n debug] ProfileForm – Profession & Politics");
      console.log("lng:", i18next.language);
      console.log("ns:", i18next.options?.ns);
      const hasProfileNs =
        i18next.language &&
        i18next.hasResourceBundle(i18next.language, "profile");
      console.log("has profile ns:", hasProfileNs);

      const keysToTest = [
        "profile:Profession category.administration",
        "profile:options.professionCategory.administration",
        "profile:professionCategory.administration",
        "profile:Political ideology.left",
        "profile:options.politicalIdeology.left",
        "profile:politicalIdeology.left",
        "profile:labels.professionCategory",
        "profile:professionCategory.label",
      ];

      keysToTest.forEach((k) => {
        const v = i18next.t(k, { defaultValue: "<MISS>" });
        console.log(k, "=>", v);
      });
      console.groupEnd();
    } catch (e) {
      console.warn("[i18n debug] ProfileForm failed:", e);
    }
  }
  // --- REPLACE END ---

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

      politicalIdeology: user.politicalIdeology || "",

      children: user.children || "",
      pets: user.pets || "",
      smoke: user.smoke || "",
      drink: user.drink || "",
      drugs: user.drugs || "",

      height: user.height ?? null,
      heightUnit: user.heightUnit || "",
      weight: user.weight ?? null,
      weightUnit: user.weightUnit || "",
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

  // Preserve edits when user object refreshes
  useEffect(() => {
    const current = getValues();
    reset({
      ...user,
      ...current,
      nutritionPreferences: Array.isArray(user.nutritionPreferences)
        ? user.nutritionPreferences[0]
        : current.nutritionPreferences ?? user.nutritionPreferences ?? "",
      extraImages: current.extraImages ?? user.extraImages ?? [],
      profilePhoto: current.profilePhoto ?? user.profilePicture ?? "",
      politicalIdeology:
        current.politicalIdeology ?? user.politicalIdeology ?? "",
      heightUnit: current.heightUnit ?? user.heightUnit ?? "",
      weightUnit: current.weightUnit ?? user.weightUnit ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reset]);

  const [localExtraImages, setLocalExtraImages] = useState(user.extraImages || []);
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
// --- REPLACE START: continuation with Political Ideology field (normalize units on submit + log validation errors) ---
  const onFormSubmit = async (data) => {
    console.log("[ProfileForm] Submitting payload (raw):", data);

    // Normalize units so backend always receives canonical values
    const normalizeHeightUnit = (u) =>
      u === "cm" ? "Cm" : u === "ftin" ? "FtIn" : u;
    const normalizeWeightUnit = (u) =>
      u === "KG" ? "kg" : u === "LB" ? "lb" : u;

    const payload = {
      ...data,
      heightUnit: normalizeHeightUnit(data.heightUnit),
      weightUnit: normalizeWeightUnit(data.weightUnit),
      nutritionPreferences: data.nutritionPreferences
        ? [data.nutritionPreferences]
        : [],
      extraImages: localExtraImages,
      profilePhoto: data.profilePhoto,
    };

    console.log("[ProfileForm] Submitting payload (normalized):", payload);
    await onSubmitProp?.(payload);
  };

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

  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    setSlideIndex(0);
  }, [slideshowImages.length]);

  useEffect(() => {
    if (slideshowImages.length < 2) return;
    const iv = setInterval(() => {
      setSlideIndex((i) => (i + 1) % slideshowImages.length);
    }, 3000);
    return () => clearInterval(iv);
  }, [slideshowImages]);

  // --- REPLACE START: helpers to translate with both key styles (space/camelCase) and prefer options.* ---
  const tProfessionLabel = () => {
    return (
      t("profile:Profession category", { defaultValue: "" }) ||
      t("profile:professionCategory.label", { defaultValue: "" }) ||
      t("profile:professionCategory", { defaultValue: "" }) ||
      "Profession category"
    );
  };

  const tProfessionOption = (opt) => {
    const key = PROF_KEY_BY_LABEL[opt] || opt.toLowerCase();
    return (
      // Prefer the canonical options.* namespace first
      t(`profile:options.professionCategory.${key}`, { defaultValue: "" }) ||
      // Fallbacks for older keys kept intentionally
      t(`profile:Profession category.${key}`, { defaultValue: "" }) ||
      t(`profile:professionCategory.${key}`, { defaultValue: "" }) ||
      opt
    );
  };

  const tPoliticalLabel = () => {
    return (
      t("profile:politicalIdeology", { defaultValue: "" }) ||
      t("profile:Political ideology", { defaultValue: "" }) ||
      "Political ideology"
    );
  };

  const tPoliticalOption = (opt) => {
    const key = POL_KEY_BY_LABEL[opt] || opt.toLowerCase();
    return (
      // Prefer the canonical options.* namespace first
      t(`profile:options.politicalIdeology.${key}`, { defaultValue: "" }) ||
      // Fallbacks for older keys kept intentionally
      t(`profile:Political ideology.${key}`, { defaultValue: opt }) ||
      t(`profile:politicalIdeology.${key}`, { defaultValue: opt }) ||
      opt
    );
  };
  // --- REPLACE END ---

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(
          onFormSubmit,
          (errs) => {
            console.warn("[ProfileForm] Validation errors:", errs);
          }
        )}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        <input type="hidden" {...methods.register("profilePhoto")} />

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
              {t("profile:managePhotos") || "Manage Photos"}
            </Link>
          </div>
        )}

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
        />

        <FormEducation t={t} />

        {/* Profession + Religion + Political Ideology */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {tProfessionLabel()}
            </label>
            <select
              {...methods.register("professionCategory")}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">{t("common:select")}</option>
              {professionCategories.map((opt) => (
                <option key={opt} value={opt}>
                  {tProfessionOption(opt)}
                </option>
              ))}
            </select>
            {errors.professionCategory && (
              <p className="mt-1 text-red-600">
                {errors.professionCategory.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              💼 {t("profile:profession")}
            </label>
            <input
              type="text"
              {...methods.register("profession")}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={t("profile:professionPlaceholder")}
            />
            {errors.profession && (
              <p className="mt-1 text-red-600">{errors.profession.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              🕊 {t("profile:religion.label")}
            </label>
            <select
              {...methods.register("religion")}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {religionOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt
                    ? t(`religion.${opt.toLowerCase()}`) || opt
                    : t("common:select")}
                </option>
              ))}
            </select>
            {errors.religion && (
              <p className="mt-1 text-red-600">{errors.religion.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("profile:religionImportance.label")}
          </label>
          <select
            {...methods.register("religionImportance")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {religionImportanceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt || t("common:select")}
              </option>
            ))}
          </select>
          {errors.religionImportance && (
            <p className="mt-1 text-red-600">
              {errors.religionImportance.message}
            </p>
          )}
        </div>

        {/* New: Political Ideology */}
        <div>
          <label className="block text-sm font-medium mb-1">
            🗳 {tPoliticalLabel()}
          </label>
          <select
            {...methods.register("politicalIdeology")}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {politicalIdeologyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt ? tPoliticalOption(opt) : t("common:select")}
              </option>
            ))}
          </select>
          {errors.politicalIdeology && (
            <p className="mt-1 text-red-600">
              {errors.politicalIdeology.message}
            </p>
          )}
        </div>

        <FormChildrenPets t={t} errors={errors} />

        <FormLifestyle t={t} includeAllOption />

        <FormGoalSummary
          t={t}
          errors={errors}
          fieldName="goal"
          summaryField="summary"
        />

        <FormLookingFor t={t} errors={errors} fieldName="lookingFor" />

        {!hidePhotoSection && userId && (
          <MultiStepPhotoUploader
            userId={userId}
            isPremium={isPremium}
            extraImages={localExtraImages}
            onSuccess={(payload) => {
              const updated = Array.isArray(payload)
                ? payload
                : payload?.extraImages || payload || [];
              setLocalExtraImages(updated);
              onUserUpdate({ ...user, extraImages: updated });
            }}
            onError={(err) => console.error(err)}
          />
        )}

        {Object.keys(errors || {}).length > 0 && (
          <p className="text-sm mt-2 text-red-600">
            {t("common:fixErrors") ||
              "Please fix the highlighted fields before saving."}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {t("profile:save")}
          </button>
        </div>

        {success && (
          <p className="text-center text-green-600">
            {t("profile:saveSuccess")}
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

// --- REPLACE START: remove duplicate default export at end of file ---
// (Removed to avoid "Only one default export allowed per module")
// export default ProfileForm;
// --- REPLACE END ---
