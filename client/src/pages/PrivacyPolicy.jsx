// File: client/src/pages/PrivacyPolicy.jsx (tai se tiedosto, jossa tämä komponentti on)

// --- REPLACE START: i18n-aware Privacy Policy page ---
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * PrivacyPolicy
 * This page explains what personal data is collected,
 * how it is used, and your rights. Texts come from privacy.json per language.
 */
const PrivacyPolicy = () => {
  const { t } = useTranslation("privacy");

  useEffect(() => {
    document.title = t("title", { defaultValue: "Privacy Policy" });
  }, [t]);

  const title = t("title", { defaultValue: "Privacy Policy" });

  const intro = t("intro", {
    defaultValue:
      "We respect your privacy. This page explains what data we collect and why. We only collect the minimum necessary to operate the Loventia service.",
  });

  const whatWeCollectTitle = t("whatWeCollectTitle", {
    defaultValue: "What data we collect",
  });

  const accountDetails = t("whatWeCollectItems.accountDetails", {
    defaultValue: "Account details (email, profile data you add).",
  });

  const analytics = t("whatWeCollectItems.analytics", {
    defaultValue:
      "Optional analytics data (only with your consent) to understand how the app is used.",
  });

  const technicalLogs = t("whatWeCollectItems.technicalLogs", {
    defaultValue:
      "Technical logs (IP address, browser and device information) to secure the service.",
  });

  const howWeUseItTitle = t("howWeUseItTitle", {
    defaultValue: "How we use your data",
  });

  const howWeUseItText = t("howWeUseItText", {
    defaultValue:
      "We use your data to provide and secure the service, prevent fraud and abuse, and improve Loventia. We do not sell your personal data.",
  });

  const yourRightsTitle = t("yourRightsTitle", {
    defaultValue: "Your rights",
  });

  const yourRightsText = t("yourRightsText", {
    defaultValue:
      "You can request access to your data, as well as its correction or deletion, at any time within the limits of applicable law.",
  });

  const contactTitle = t("contactTitle", {
    defaultValue: "How you can contact us",
  });

  const contactText = t("contactText", {
    defaultValue:
      "If you have any questions about this policy or your data, you can contact our support via the app or by email.",
  });

  const lastUpdatedPrefix = t("lastUpdatedPrefix", {
    defaultValue: "Last updated:",
  });

  const lastUpdatedDate = new Date().toLocaleDateString();

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>

      <p className="mb-4">{intro}</p>

      <h2 className="text-xl font-semibold mt-4 mb-2">
        {whatWeCollectTitle}
      </h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>{accountDetails}</li>
        <li>{technicalLogs}</li>
        <li>{analytics}</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4 mb-2">
        {howWeUseItTitle}
      </h2>
      <p className="mb-4">{howWeUseItText}</p>

      <h2 className="text-xl font-semibold mt-4 mb-2">
        {yourRightsTitle}
      </h2>
      <p className="mb-4">{yourRightsText}</p>

      <h2 className="text-xl font-semibold mt-4 mb-2">
        {contactTitle}
      </h2>
      <p className="mb-4">{contactText}</p>

      <p className="text-sm text-gray-500">
        {lastUpdatedPrefix} {lastUpdatedDate}
      </p>
    </div>
  );
};

export default PrivacyPolicy;
// --- REPLACE END ---


