// PATH: client/src/components/profile/ProfileForm.jsx

// --- REPLACE START: keep structure, enforce EN constants, FI→EN fallbacks, strict cleanup before submit, avoid forbidden fields, and expose debug payload in dev ---
import PropTypes from "prop-types";
import { yupResolver } from "@hookform/resolvers/yup";
import React, { useState, useEffect, useMemo, useCallback } from "react";
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

// Normalize Windows backslashes and ensure a single leading slash
const normalizePath = (p = "") =>
  "/" + String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");

// ===================================================================================
// EN constants for selects (values that backend expects)
// ===================================================================================
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

// Religion (EN constants)
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

// Diet (single-select in UI, array in payload if chosen)
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

// ===================================================================================
// FI → EN fallback maps (defensive; in case localized values slipped into state)
// ===================================================================================
const FI_EN_CHILDREN = {
  "Kyllä": "yes",
  "Ei": "no",
  "Aikuisia lapsia": "adultChildren",
  "Muu": "other",
};
const FI_EN_PETS = {
  "Kissa": "cat",
  "Koira": "dog",
  "Molemmat": "both",
  "Ei lemmikkiä": "none",
  "Muu": "other",
};
const FI_EN_EDUCATION = {
  "Peruskoulu": "Basic",
  "Toinen aste": "Secondary",
  "Ammatillinen": "Vocational",
  "Korkeakoulu / yliopisto": "Higher",
  "Tohtori / tutkimus": "PhD",
  "Muu": "Other",
};

// Explicit list of fields we should NEVER forward to the backend from this form
const FORBIDDEN_KEYS = new Set([
  "photos",
  "extraImages",
  "entitlements",
  "visibility",
  "subscriptionId",
  "stripeCustomerId",
  "quotas",
  "createdAt",
  "updatedAt",
  "__v",
  "_id",
  "id", // server derives/validates identity; avoid accidental mismatch
]);

// Utility: drop keys in place
const dropForbiddenKeys = (obj) => {
  FORBIDDEN_KEYS.forEach((k) => {
    if (k in obj) delete obj[k];
  });
  return obj;
};

// ===================================================================================
// Validation schema
// ===================================================================================
const schema = yup.object().shape({
  username: yup.string().required("Required"),
  email: yup.string().email("Invalid email").required("Required"),
  age: yup
    .number()
    .typeError("Age must be a number")
    .min(18, "Must be at least 18")
    .required("Required"),
  gender: yup.string().required("Required"),
  orientation: yup.string(),

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
  profession: yup.string(),

  religion: yup.string().oneOf(religionOptions, "Invalid religion"),
  religionImportance: yup
    .string()
    .oneOf(religionImportanceOptions, "Invalid importance"),

  politicalIdeology: yup
    .string()
    .oneOf(politicalIdeologyOptions, "Invalid political ideology"),

  children: yup.string(),
  pets: yup.string(),
  smoke: yup.string(),
  drink: yup.string(),
  drugs: yup.string(),

  height: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),
  heightUnit: yup
    .string()
    .oneOf(["", "Cm", "FtIn", "cm", "ftin"], "Invalid unit"),

  weight: yup
    .number()
    .nullable()
    .transform((v, o) => (o === "" ? null : v)),
  weightUnit: yup
    .string()
    .oneOf(["", "kg", "lb", "KG", "LB"], "Invalid unit"),

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

  // Kept in state for UX; not submitted in this form payload
  extraImages: yup.array().of(yup.string()),
});
export default function ProfileForm({
  userId,
  user,
  isPremium = false,
  t,
  message = "",
  success = false,
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

      // local only
      extraImages: user.extraImages || [],
    },
  });

  const {
    handleSubmit,
    reset,
    formState: { errors },
    getValues,
    setValue,
  } = methods;

  // Reset when user changes
  useEffect(() => {
    const current = getValues();
    reset({
      ...user,
      ...current,
      nutritionPreferences: Array.isArray(user.nutritionPreferences)
        ? user.nutritionPreferences[0]
        : current.nutritionPreferences ??
          user.nutritionPreferences ??
          "",
      extraImages: current.extraImages ?? user.extraImages ?? [],
      profilePhoto: current.profilePhoto ?? user.profilePicture ?? "",
      politicalIdeology:
        current.politicalIdeology ?? user.politicalIdeology ?? "",
      heightUnit: current.heightUnit ?? user.heightUnit ?? "",
      weightUnit: current.weightUnit ?? user.weightUnit ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reset]);

  const [localExtraImages, setLocalExtraImages] = useState(
    user.extraImages || []
  );
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

  // Guard helpers
  const guardSelect =
    (field, allowed) =>
    (e) => {
      const v = e?.target?.value ?? "";
      if (allowed.includes(v) || v === "") {
        setValue(field, v, { shouldValidate: true, shouldDirty: true });
      } else {
        const fallback =
          allowed.find(
            (x) => x.toLowerCase() === String(v).toLowerCase()
          ) || "";
        setValue(field, fallback, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    };

  const onProfessionCategoryChange = useCallback(
    guardSelect("professionCategory", professionCategories),
    []
  );
  const onReligionChange = useCallback(
    guardSelect("religion", religionOptions),
    []
  );
  const onImportanceChange = useCallback(
    guardSelect("religionImportance", religionImportanceOptions),
    []
  );
  const onPoliticalChange = useCallback(
    guardSelect("politicalIdeology", politicalIdeologyOptions),
    []
  );

  // Submit cleanup
  const onFormSubmit = async (data) => {
    const normalizeHeightUnit = (u) =>
      u === "cm" ? "Cm" : u === "ftin" ? "FtIn" : u || "";
    const normalizeWeightUnit = (u) =>
      u === "KG" ? "kg" : u === "LB" ? "lb" : u || "";

    const working = { ...data };

    working.heightUnit = normalizeHeightUnit(working.heightUnit);
    working.weightUnit = normalizeWeightUnit(working.weightUnit);

    if (working.children && FI_EN_CHILDREN[working.children]) {
      working.children = FI_EN_CHILDREN[working.children];
    }
    if (working.pets && FI_EN_PETS[working.pets]) {
      working.pets = FI_EN_PETS[working.pets];
    }
    if (working.education && FI_EN_EDUCATION[working.education]) {
      working.education = FI_EN_EDUCATION[working.education];
    }

    ["age", "height", "weight", "latitude", "longitude"].forEach((k) => {
      const raw = working[k];
      if (raw === "" || raw == null) {
        delete working[k];
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n)) delete working[k];
        else working[k] = n;
      }
    });

    Object.keys(working).forEach((k) => {
      if (working[k] === "" || working[k] == null) delete working[k];
    });

    if (typeof working.nutritionPreferences !== "undefined") {
      const v = String(working.nutritionPreferences || "").trim();
      if (v) working.nutritionPreferences = [v];
      else delete working.nutritionPreferences;
    }

    delete working.customCountry;
    delete working.customRegion;
    delete working.customCity;

    const loc = {};
    if (typeof working.country !== "undefined") loc.country = working.country;
    if (typeof working.region !== "undefined") loc.region = working.region;
    if (typeof working.city !== "undefined") loc.city = working.city;
    if (Object.keys(loc).length)
      working.location = { ...(working.location || {}), ...loc };

    if (typeof working.politicalIdeology !== "undefined") {
      working.ideology = working.politicalIdeology;
    }

    dropForbiddenKeys(working);
    if (Array.isArray(working.extraImages) && working.extraImages.length === 0)
      delete working.extraImages;

    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      console.debug("[ProfileForm] Sanitized payload →", working);
      window.__lastProfileSubmit = working;
    }

    await onSubmitProp?.(working);
  };

  // Slideshow
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
  useEffect(() => setSlideIndex(0), [slideshowImages.length]);
  useEffect(() => {
    if (slideshowImages.length < 2) return;
    const iv = setInterval(
      () => setSlideIndex((i) => (i + 1) % slideshowImages.length),
      3500
    );
    return () => clearInterval(iv);
  }, [slideshowImages]);

  const nextSlide = () =>
    setSlideIndex((i) => (i + 1) % Math.max(slideshowImages.length, 1));
  const prevSlide = () =>
    setSlideIndex(
      (i) =>
        (i - 1 + Math.max(slideshowImages.length, 1)) %
        Math.max(slideshowImages.length, 1)
    );

  // i18n helpers
  const tProfessionLabel = () =>
    t("profile:Profession category", { defaultValue: "" }) ||
    t("profile:professionCategory.label", { defaultValue: "" }) ||
    t("profile:professionCategory", { defaultValue: "" }) ||
    "Profession category";

  const tProfessionOption = (opt) => {
    const key = PROF_KEY_BY_LABEL[opt] || opt.toLowerCase();
    return (
      t(`profile:options.professionCategory.${key}`, { defaultValue: "" }) ||
      t(`profile:Profession category.${key}`, { defaultValue: "" }) ||
      t(`profile:professionCategory.${key}`, { defaultValue: "" }) ||
      opt
    );
  };

  const tPoliticalLabel = () =>
    t("profile:politicalIdeology", { defaultValue: "" }) ||
    t("profile:Political ideology", { defaultValue: "" }) ||
    "Political ideology";

  const tPoliticalOption = (opt) => {
    const key = POL_KEY_BY_LABEL[opt] || opt.toLowerCase();
    return (
      t(`profile:options.politicalIdeology.${key}`, { defaultValue: opt }) ||
      t(`profile:Political ideology.${key}`, { defaultValue: opt }) ||
      t(`profile:politicalIdeology.${key}`, { defaultValue: opt }) ||
      opt
    );
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(
          onFormSubmit,
          (errs) => console.warn("[ProfileForm] Validation errors:", errs)
        )}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        <input type="hidden" {...methods.register("profilePhoto")} />

        {!hideAvatarSection && slideshowImages.length > 0 && (
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img
                src={slideshowImages[slideIndex]}
                alt={`Avatar ${slideIndex + 1}`}
                className="w-32 h-32 rounded-full object-cover"
              />
              {slideshowImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white px-2 py-1 rounded-l text-sm"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white px-2 py-1 rounded-r text-sm"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
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
              onChange={onProfessionCategoryChange}
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
              <p className="mt-1 text-red-600">
                {errors.profession.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              🕊 {t("profile:religion.label")}
            </label>
            <select
              {...methods.register("religion")}
              onChange={onReligionChange}
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
            onChange={onImportanceChange}
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

        {/* Political Ideology */}
        <div>
          <label className="block text-sm font-medium mb-1">
            🗳 {tPoliticalLabel()}
          </label>
          <select
            {...methods.register("politicalIdeology")}
            onChange={onPoliticalChange}
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

        <div className="flex items-center justify-between">
          {slideshowImages.length > 1 ? (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <button
                type="button"
                onClick={prevSlide}
                className="px-2 py-1 border rounded"
              >
                {t("common:prev") || "Prev"}
              </button>
              <span>
                {slideIndex + 1}/{slideshowImages.length}
              </span>
              <button
                type="button"
                onClick={nextSlide}
                className="px-2 py-1 border rounded"
              >
                {t("common:next") || "Next"}
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">&nbsp;</span>
          )}

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

ProfileForm.propTypes = {
  userId: PropTypes.string,
  user: PropTypes.object.isRequired,
  isPremium: PropTypes.bool,
  t: PropTypes.func.isRequired,
  message: PropTypes.string,
  success: PropTypes.bool,
  onUserUpdate: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  onSubmitProp: PropTypes.func,
  hideAvatarSection: PropTypes.bool,
  hidePhotoSection: PropTypes.bool,
};
// --- REPLACE END ---
