// File: client/src/components/ReportButton.jsx
// Passive report button + simple modal. Uses /api/reports.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";
import Button from "./ui/Button";

export default function ReportButton({
  targetUserId,
  messageId,
  compact = false,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  // Safety: do not render if we have no target
  if (!targetUserId && !messageId) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setInfo("");
    setError("");

    try {
      await api.post("/reports", {
        targetUserId,
        messageId,
        reason,
        details: details && details.trim() ? details.trim() : undefined,
      });

      setInfo(
        t(
          "report.thanks",
          "Thank you. Your report has been received. We may review it as part of our safety checks."
        )
      );
      setDetails("");
      setOpen(false);
    } catch (err) {
      console.error("Report error:", err);
      setError(
        t(
          "report.error",
          "We could not send your report right now. Please try again later."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const triggerLabel = compact
    ? t("report.link", "Report")
    : t("report.linkFull", "Report this user");

  return (
    <div className="text-xs text-gray-600">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setInfo("");
          setError("");
        }}
        className="underline hover:text-red-600"
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold">
              {t("report.title", "Report")}
            </h3>
            <p className="text-sm text-gray-700">
              {t(
                "report.helpText",
                "Select a reason and optionally describe what happened. We use reports to improve safety, but we do not contact every reporter."
              )}
            </p>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("report.reasonLabel", "Reason")}
                </label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="spam">
                    {t("report.reason.spam", "Spam or unwanted ads")}
                  </option>
                  <option value="scam">
                    {t(
                      "report.reason.scam",
                      "Scam or asking for money / financial help"
                    )}
                  </option>
                  <option value="abuse">
                    {t(
                      "report.reason.abuse",
                      "Harassment, threats, or hate speech"
                    )}
                  </option>
                  <option value="fake_profile">
                    {t(
                      "report.reason.fake_profile",
                      "Fake, stolen, or misleading profile"
                    )}
                  </option>
                  <option value="underage">
                    {t(
                      "report.reason.underage",
                      "I believe this user may be underage"
                    )}
                  </option>
                  <option value="other">
                    {t("report.reason.other", "Something else")}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("report.detailsLabel", "Details (optional)")}
                </label>
                <textarea
                  className="w-full border rounded px-2 py-1 text-sm min-h-[80px]"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    "report.detailsHint",
                    "Do not include passwords or full payment details here. If you already sent money or card details, contact your bank or card issuer."
                  )}
                </p>
              </div>

              {info && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                  {info}
                </div>
              )}
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    setOpen(false);
                    setError("");
                    setInfo("");
                  }}
                >
                  {t("buttons.cancel", "Cancel")}
                </button>
                <Button type="submit" disabled={submitting} variant="red">
                  {submitting
                    ? t("report.submitting", "Sending…")
                    : t("report.submit", "Send report")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
