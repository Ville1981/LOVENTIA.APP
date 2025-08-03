import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const rtlLanguages = ["ar", "he", "fa", "ur"];
    const updateDir = (lng) => {
      document.documentElement.setAttribute("dir", rtlLanguages.includes(lng) ? "rtl" : "ltr");
    };

    updateDir(i18n.language);
    i18n.on("languageChanged", updateDir);
    return () => i18n.off("languageChanged", updateDir);
  }, [i18n]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };

  return (
    <select
      value={i18n.language}
      onChange={(e) => changeLanguage(e.target.value)}
      className="bg-white text-blue-800 px-2 py-1 rounded text-sm shadow-sm"
    >
      <option disabled>🌐 Languages</option>

      <optgroup label="🇪🇺 EUROPE">
        <option value="en-GB">🇬🇧 English (UK)</option>
        <option value="es-ES">🇪🇸 Español (Spain)</option>
        <option value="pt">🇵🇹 Português (Portugal)</option>
        <option value="fr">🇫🇷 Français (France)</option>
        <option value="de">🇩🇪 Deutsch (Germany)</option>
        <option value="el">🇬🇷 Ελληνικά (Greece)</option>
        <option value="it">🇮🇹 Italiano (Italia)</option>
        <option value="ru">🇷🇺 Русский (Russia)</option>
        <option value="pl">🇵🇱 Polski (Polska)</option>
        <option value="tr">🇹🇷 Türkçe (Turkey)</option>
        <option value="fi">🇫🇮 Suomi (Finland)</option>
        <option value="sv">🇸🇪 Svenska (Sweden)</option>
      </optgroup>

      <optgroup label="🇺🇸 NORTH AMERICA">
        <option value="en-US">🇺🇸 English (US)</option>
      </optgroup>

      <optgroup label="🌎 SOUTH AMERICA">
        <option value="pt-BR">🇧🇷 Português (Brasil)</option>
        <option value="es-AR">🇦🇷 Español (Argentina)</option>
        <option value="es-CO">🇨🇴 Español (Colombia)</option>
        <option value="es-MX">🇲🇽 Español (México)</option>
      </optgroup>

      <optgroup label="🌏 SOUTH ASIA">
        <option value="hi">🇮🇳 हिन्दी (India)</option>
        <option value="ur">🇵🇰 اردو (Pakistan)</option>
      </optgroup>

      <optgroup label="🌍 MIDDLE EAST">
        <option value="ar">🇸🇦 العربية (Saudi Arabia)</option>
        <option value="he">🇮🇱 עברית (Israel)</option>
      </optgroup>

      <optgroup label="🌏 ASIA / OTHER">
        <option value="zh">🇨🇳 中文 (China)</option>
        <option value="ja">🇯🇵 日本語 (Japan)</option>
      </optgroup>

      <optgroup label="🌍 AFRICA">
      <option value="sw">🇰🇪 Kiswahili (Swahili)</option>
      </optgroup>

    </select>
  );
};

export default LanguageSwitcher;
