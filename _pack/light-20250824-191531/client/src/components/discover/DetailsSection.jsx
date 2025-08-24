// --- REPLACE START: Added political ideology display in details section ---
import PropTypes from "prop-types";
import React from "react";
import { useTranslation } from "react-i18next";

// Helpers to normalize various incoming enum-like values to i18n keys
const toKey = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ") // collapse separators
    .replace(/\s+(and|&)\s+/g, "and")
    .replace(/\s+/g, " ")
    .replace(/\band\b/g, "") // keep keys simple
    .replace(/\s+/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");

const GENDER_KEY = {
  male: "male",
  man: "male",
  männlich: "male",
  female: "female",
  woman: "female",
  weiblich: "female",
  nonbinary: "nonbinary",
  "non-binary": "nonbinary",
  other: "other",
};

const ORIENTATION_KEY = {
  straight: "straight",
  hetero: "straight",
  heterosexual: "straight",
  gay: "gay",
  homo: "gay",
  homosexual: "gay",
  lesbian: "lesbian",
  bi: "bisexual",
  bisexual: "bisexual",
  asexual: "asexual",
  pansexual: "pansexual",
  queer: "queer",
  questioning: "questioning",
  other: "other",
};

const RELIGION_KEY = {
  christianity: "christianity",
  christian: "christianity",
  christ: "christianity",
  islam: "islam",
  muslim: "islam",
  hinduism: "hinduism",
  hindu: "hinduism",
  buddhism: "buddhism",
  buddhist: "buddhism",
  folk: "folk",
  none: "none",
  atheism: "atheism",
  atheist: "atheism",
  spiritual: "spiritual",
  agnostic: "agnostic",
  jewish: "jewish",
  judaism: "jewish",
};

const POLITICAL_KEY = {
  left: "left",
  centre: "centre",
  center: "centre",
  right: "right",
  conservatism: "conservatism",
  liberalism: "liberalism",
  socialism: "socialism",
  communism: "communism",
  fascism: "fascism",
  environmentalism: "environmentalism",
  anarchism: "anarchism",
  nationalism: "nationalism",
  populism: "populism",
  progressivism: "progressivism",
  libertarianism: "libertarianism",
  democracy: "democracy",
  other: "other",
};

const PETS_KEY = {
  cat: "cat",
  dog: "dog",
  both: "both",
  none: "none",
  // localized fallbacks
  katze: "cat",
  hund: "dog",
  beide: "both",
  keine: "none",
};

const kidsToLabelKey = (v) => {
  const k = toKey(v);
  if (k.includes("adult")) return "profile:childrenAdult";
  if (k === "yes" || k === "kylla" || k === "kyl") return "profile:childrenYes";
  if (k === "no" || k === "ei") return "profile:childrenNo";
  return null;
};

const DetailsSection = ({ details = {} }) => {
  const { t } = useTranslation(["discover", "profile", "common"]);

  if (typeof details !== "object" || Object.keys(details).length === 0)
    return null;

  // Translators for enum-like values coming from backend
  const tGender = (v) => {
    const key = GENDER_KEY[toKey(v)];
    return key ? t(`profile:options.gender.${key}`, v) : v;
  };

  const tOrientation = (v) => {
    const key = ORIENTATION_KEY[toKey(v)];
    // Try options namespace first; fall back to older flat keys if present
    return (
      (key && (t(`profile:options.orientation.${key}`) || t(`profile:${key}`))) ||
      v
    );
  };

  const tReligion = (v) => {
    const key = RELIGION_KEY[toKey(v)];
    return key ? t(`profile:religion.${key}`, v) : v;
  };

  const tPolitical = (v) => {
    const key = POLITICAL_KEY[toKey(v)];
    return key ? t(`profile:options.politicalIdeology.${key}`, v) : v;
  };

  const tPets = (v) => {
    const key = PETS_KEY[toKey(v)];
    return key ? t(`profile:options.pets.${key}`, v) : v;
  };

  const tKids = (v) => {
    const lk = kidsToLabelKey(v);
    return lk ? t(lk) : v;
  };

  return (
    <div
      className="mt-6 focus:outline-none"
      tabIndex={-1}
      style={{
        overflowAnchor: "none", // prevent scroll anchoring
        minHeight: "5rem", // ensure stability across profiles
      }}
    >
      <div
        className="bg-[#111] text-white px-2 py-1 rounded-t-lg text-sm font-semibold focus:outline-none"
        tabIndex={-1}
        style={{ overflowAnchor: "none" }}
      >
        {t("discover:labels.title", "Details")}
      </div>
      <div
        className="border border-gray-200 border-t-0 rounded-b-lg p-4 flex flex-col space-y-2 text-gray-700 text-sm focus:outline-none"
        tabIndex={-1}
        style={{
          overflowAnchor: "none",
          minHeight: "4rem", // normalize min height of content
        }}
      >
        {details.gender && (
          <div className="flex items-center space-x-2">
            <span>👤</span>
            <span>
              {tGender(details.gender)}
              {details.orientation ? ` | ${tOrientation(details.orientation)}` : ""}
              {details.relationshipStatus ? ` | ${details.relationshipStatus}` : ""}
            </span>
          </div>
        )}
        {details.bodyType && (
          <div className="flex items-center space-x-2">
            <span>💪</span>
            <span>{details.bodyType}</span>
          </div>
        )}
        {(details.ethnicity ||
          (details.languages && details.languages.length) ||
          details.education ||
          details.employment ||
          details.religion) && (
          <div className="flex items-center space-x-2">
            <span>🌐</span>
            <span>
              {[
                details.ethnicity,
                details.languages?.length ? details.languages.join(", ") : null,
                details.education,
                details.employment,
                details.religion ? tReligion(details.religion) : null,
              ]
                .filter(Boolean)
                .join(" | ")}
            </span>
          </div>
        )}
        {details.politicalIdeology && (
          <div className="flex items-center space-x-2">
            <span>🗳️</span>
            <span>{tPolitical(details.politicalIdeology)}</span>
          </div>
        )}
        {(details.smoking || details.drinking || details.marijuana || details.diet) && (
          <div className="flex items-center space-x-2">
            <span>🚬</span>
            <span>
              {[
                details.smoking,
                details.drinking,
                details.marijuana,
                details.diet,
              ]
                .filter(Boolean)
                .join(" | ")}
            </span>
          </div>
        )}
        {details.kids && (
          <div className="flex items-center space-x-2">
            <span>👶</span>
            <span>{tKids(details.kids)}</span>
          </div>
        )}
        {details.pets && (
          <div className="flex items-center space-x-2">
            <span>🐾</span>
            <span>{tPets(details.pets)}</span>
          </div>
        )}
        {details.lookingFor && (
          <div className="flex items-center space-x-2">
            <span>🔍</span>
            <span>{details.lookingFor}</span>
          </div>
        )}
      </div>
    </div>
  );
};

DetailsSection.propTypes = {
  details: PropTypes.shape({
    gender: PropTypes.string,
    orientation: PropTypes.string,
    relationshipStatus: PropTypes.string,
    bodyType: PropTypes.string,
    ethnicity: PropTypes.string,
    languages: PropTypes.arrayOf(PropTypes.string),
    education: PropTypes.string,
    employment: PropTypes.string,
    religion: PropTypes.string,
    politicalIdeology: PropTypes.string,
    smoking: PropTypes.string,
    drinking: PropTypes.string,
    marijuana: PropTypes.string,
    diet: PropTypes.string,
    kids: PropTypes.string,
    pets: PropTypes.string,
    lookingFor: PropTypes.string,
  }),
};

export default React.memo(DetailsSection);
// --- REPLACE END ---
