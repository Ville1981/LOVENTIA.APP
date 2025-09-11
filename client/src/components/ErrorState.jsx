// client/src/components/ErrorState.jsx
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * ErrorState: displays an error title/description and an optional retry button
 *
 * Props:
 *  - title?: string (optional; if omitted, uses i18n default)
 *  - message?: string (optional; if omitted, uses i18n default description)
 *  - onRetry?: function (optional; when provided, shows a Retry button)
 *
 * Accessibility:
 *  - Wrapper uses role="alert" and aria-live="polite" so screen readers announce updates.
 *  - The error icon SVG is decorative and marked aria-hidden.
 *  - The Retry button has visible text; no aria-label needed unless rendered icon-only.
 */
export default function ErrorState({ title, message, onRetry }) {
  const { t } = useTranslation();

  // --- REPLACE START: i18n-backed defaults for title & message (leaf keys only) ---
  const headingText =
    title ??
    t("common:errors.title", {
      defaultValue: "Something went wrong",
    });

  const descriptionText =
    message ??
    t("common:errors.generic", {
      defaultValue: "An unexpected error occurred. Please try again.",
    });
  // --- REPLACE END ---

  return (
    <div
      className="flex flex-col items-center p-8 text-red-600"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-12 h-12 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z"
        />
      </svg>

      <h2 className="mb-2 text-xl font-semibold text-center">
        {String(headingText)}
      </h2>

      <p className="mb-4 text-lg text-center">{String(descriptionText)}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          type="button"
        >
          {/* --- REPLACE START: English label for retry via i18n --- */}
          {t("common:actions.retry", { defaultValue: "Try again" })}
          {/* --- REPLACE END */}
        </button>
      )}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onRetry: PropTypes.func,
};
