// PATH: client/src/pages/Support.jsx
import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Support Page (FAQ style)
 * - Provides answers to common issues.
 * - No direct contact information included.
 * - "Report" option references removed (not implemented).
 */
const Support = () => {
  // --- REPLACE START: i18n for Support page content + harden translations with String() coercion ---
  const { t } = useTranslation();

  // Helper: always render strings even if a translation key accidentally resolves to a non-string.
  const tt = (key, fallback) => String(t(key, { defaultValue: fallback }));
  // --- REPLACE END ---

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* --- REPLACE START: i18n for heading --- */}
      <h1 className="text-2xl font-bold mb-6">
        {tt("support:title", "Support - Frequently Asked Questions")}
      </h1>
      {/* --- REPLACE END --- */}

      <div className="space-y-6">
        <div>
          {/* --- REPLACE START: i18n for FAQ 1 --- */}
          <h2 className="text-lg font-semibold">
            {tt("support:faq.forgotPassword.q", "I forgot my password. What should I do?")}
          </h2>
          <p>
            {tt("support:faq.forgotPassword.a1", "Go to the login page and select")}{" "}
            <strong>{tt("support:faq.forgotPassword.linkText", "Forgot Password")}</strong>
            {tt(
              "support:faq.forgotPassword.a2",
              ". Enter your email address and follow the instructions to reset your password."
            )}
          </p>
          {/* --- REPLACE END --- */}
        </div>

        <div>
          {/* --- REPLACE START: i18n for FAQ 2 --- */}
          <h2 className="text-lg font-semibold">
            {tt("support:faq.updateProfile.q", "How can I update my profile information?")}
          </h2>
          <p>
            {tt("support:faq.updateProfile.a1", "Navigate to your")}{" "}
            <strong>{tt("support:faq.updateProfile.profileText", "Profile")}</strong>{" "}
            {tt("support:faq.updateProfile.a2", "page and select")}{" "}
            <em>{tt("support:faq.updateProfile.editText", "Edit Profile")}</em>
            {tt(
              "support:faq.updateProfile.a3",
              ". From there, you can update your details, photos, and preferences."
            )}
          </p>
          {/* --- REPLACE END --- */}
        </div>

        <div>
          {/* --- REPLACE START: i18n for FAQ 3 (mojibake-safe) --- */}
          <h2 className="text-lg font-semibold">
            {tt("support:faq.matches.q", "Why can’t I see my matches?")}
          </h2>
          <p>
            {tt(
              "support:faq.matches.a",
              "Matches only appear when both users have shown mutual interest. Make sure your profile is complete and that you are actively engaging with other users to increase your chances of matching."
            )}
          </p>
          {/* --- REPLACE END --- */}
        </div>

        <div>
          {/* --- REPLACE START: i18n for FAQ 4 --- */}
          <h2 className="text-lg font-semibold">
            {tt("support:faq.visibility.q", "How do I hide or unhide my profile?")}
          </h2>
          <p>
            {tt("support:faq.visibility.a1", "Go to")}{" "}
            <strong>{tt("support:faq.visibility.settingsText", "Settings")}</strong>{" "}
            {tt(
              "support:faq.visibility.a2",
              "and toggle the visibility option. You can hide your profile temporarily or make it visible again at any time."
            )}
          </p>
          {/* --- REPLACE END --- */}
        </div>
      </div>
    </div>
  );
};

export default Support;



