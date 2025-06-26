import React from "react";
import PropTypes from "prop-types";

const lifestyleOptions = [
  { value: "", labelKey: "common.select" },
  { value: "no", labelKey: "lifestyle.no" },
  { value: "little", labelKey: "lifestyle.little" },
  { value: "average", labelKey: "lifestyle.average" },
  { value: "much", labelKey: "lifestyle.much" },
  { value: "sober", labelKey: "lifestyle.sober" },
];

const FormLifestyle = ({ smoke, drink, drugs, setSmoke, setDrink, setDrugs, t }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{t("lifestyle.title")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Smoke */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.smoke")}
          </label>
          <select
            value={smoke}
            onChange={(e) => setSmoke(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        {/* Drink */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.drink")}
          </label>
          <select
            value={drink}
            onChange={(e) => setDrink(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        {/* Drugs */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("lifestyle.drugs")}
          </label>
          <select
            value={drugs}
            onChange={(e) => setDrugs(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {lifestyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

FormLifestyle.propTypes = {
  smoke: PropTypes.string.isRequired,
  drink: PropTypes.string.isRequired,
  drugs: PropTypes.string.isRequired,
  setSmoke: PropTypes.func.isRequired,
  setDrink: PropTypes.func.isRequired,
  setDrugs: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default FormLifestyle;
