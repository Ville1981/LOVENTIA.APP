// PATH: client/src/components/discover/ReportButton.jsx

// --- REPLACE START: ReportButton – debug edition with stubborn focus fix ---
import PropTypes from "prop-types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../utils/axiosInstance.js";

// Toggle this to false later if logs are too noisy
const DEBUG_REPORT_BUTTON = true;

// Allowed reasons (enum keys used also by backend)
const REASONS = ["spam", "scam", "abuse", "fake_profile", "underage", "other"];

function ReportButton({ targetUserId, messageId, compact }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState(""); // kept for reset purposes
  const [detailsVersion, setDetailsVersion] = useState(0); // forces textarea reset when needed
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // "ok" | "error" | null
  const [errorMessage, setErrorMessage] = useState("");
  const [reasonMenuOpen, setReasonMenuOpen] = useState(false);

  const containerRef = useRef(null);
  const detailsRef = useRef(""); // live value while typing
  const textareaRef = useRef(null); // DOM ref for stubborn focus
  const allowBlurRef = useRef(false); // when true, blur is allowed and we do not re-focus

  // Initial mount / unmount debug
  useEffect(() => {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] mount", {
        targetUserId,
        messageId,
      });
    }
    return () => {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] unmount", {
          targetUserId,
          messageId,
        });
      }
    };
    // We want this only on true mount/unmount, so no deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State change debug
  useEffect(() => {
    if (!DEBUG_REPORT_BUTTON) return;
    // eslint-disable-next-line no-console
    console.log("[ReportButton] state", {
      open,
      reason,
      status,
      detailsLength: details ? details.length : 0,
      reasonMenuOpen,
    });
  }, [open, reason, status, details, reasonMenuOpen]);

  // Helper to fully reset details field (state + DOM)
  const resetDetails = useCallback(() => {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] resetDetails");
    }
    setDetails("");
    detailsRef.current = "";
    setDetailsVersion((v) => v + 1); // new key → textarea cleared
  }, []);

  // Reset when target changes
  useEffect(() => {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] target changed, reset", {
        targetUserId,
        messageId,
      });
    }
    setOpen(false);
    setReason("");
    resetDetails();
    setSubmitting(false);
    setStatus(null);
    setErrorMessage("");
    setReasonMenuOpen(false);
  }, [targetUserId, messageId, resetDetails]);

  const toggleOpen = () => {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] toggleOpen", { prevOpen: open });
    }
    // Kun suljetaan kortti, sallitaan blur, ettei textarea taistele vastaan.
    if (open) {
      allowBlurRef.current = true;
    }
    setOpen((prev) => !prev);
    setReasonMenuOpen(false);
  };

  // Esc closes whole report card + reason menu
  const handleKeyDown = useCallback(
    (evt) => {
      if (evt.key === "Escape") {
        if (DEBUG_REPORT_BUTTON) {
          // eslint-disable-next-line no-console
          console.log("[ReportButton] global keydown Escape", {
            open,
            reasonMenuOpen,
          });
        }
        allowBlurRef.current = true; // we are intentionally closing
        setReasonMenuOpen(false);
        setOpen(false);
      }
    },
    [open, reasonMenuOpen],
  );

  useEffect(() => {
    if (!open) return;
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] attach document keydown listener");
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] detach document keydown listener");
      }
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  // Click outside card closes only reason menu (keeping card open)
  useEffect(() => {
    if (!reasonMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!containerRef.current) return;
      const isInside = containerRef.current.contains(event.target);
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] document mousedown", {
          reasonMenuOpen,
          isInside,
          targetTag: event.target?.tagName,
          targetClass: event.target?.className,
        });
      }
      if (!isInside) {
        setReasonMenuOpen(false);
      }
    };

    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] attach document mousedown listener");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] detach document mousedown listener");
      }
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [reasonMenuOpen]);

  const handleReasonSelect = (key) => {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] handleReasonSelect", { key });
    }
    setReason(key);
    setReasonMenuOpen(false);
  };

  const currentReasonLabel = reason
    ? t(`report.reason.${reason}`)
    : t("select");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] submit ignored, already submitting");
      }
      return;
    }
    if (!reason) {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] submit ignored, no reason selected");
      }
      return;
    }
    if (!targetUserId && !messageId) {
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] submit ignored, no target provided");
      }
      return;
    }

    setSubmitting(true);
    setStatus(null);
    setErrorMessage("");

    // Prefer the latest value from state, but keep ref in sync
    const rawDetails =
      (detailsRef.current != null ? detailsRef.current : details) || "";
    const trimmedDetails = rawDetails.trim();

    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] submitting report", {
        targetUserId,
        messageId,
        reason,
        detailsLength: trimmedDetails.length,
      });
    }

    try {
      await api.post("/report", {
        targetUserId: targetUserId || undefined,
        messageId: messageId || undefined,
        reason,
        details: trimmedDetails ? trimmedDetails : undefined,
      });

      setStatus("ok");
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] submit success");
      }
      // Keep card open so thank-you message is visible; clear details only.
      resetDetails();
      setReason("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Report submit failed", err);
      setStatus("error");
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "";
      setErrorMessage(serverMsg);
      if (DEBUG_REPORT_BUTTON) {
        // eslint-disable-next-line no-console
        console.log("[ReportButton] submit error", { serverMsg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!targetUserId && !messageId) {
    if (DEBUG_REPORT_BUTTON) {
      // eslint-disable-next-line no-console
      console.log("[ReportButton] no targetUserId/messageId, return null");
    }
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="mt-3 relative"
      // Guard: stop clicks inside the card from bubbling to any global
      // click-handlers that might close popups/forms elsewhere.
      onMouseDown={(e) => {
        if (DEBUG_REPORT_BUTTON) {
          // eslint-disable-next-line no-console
          console.log("[ReportButton] container onMouseDown", {
            targetTag: e.target?.tagName,
            targetClass: e.target?.className,
          });
        }
        e.stopPropagation();
      }}
      onClick={(e) => {
        if (DEBUG_REPORT_BUTTON) {
          // eslint-disable-next-line no-console
          console.log("[ReportButton] container onClick", {
            targetTag: e.target?.tagName,
            targetClass: e.target?.className,
          });
        }
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        className={
          compact
            ? "text-xs underline text-gray-500 hover:text-gray-700"
            : "text-sm underline text-gray-500 hover:text-gray-700"
        }
      >
        {t("report.link")}
      </button>

      {open && (
        <div className="mt-2 border rounded-2xl bg-white shadow-sm p-4 max-w-md text-sm">
          <h3 className="font-semibold mb-1">{t("report.title")}</h3>
          <p className="text-xs text-gray-600 mb-3">{t("report.helpText")}</p>

          <form
            onSubmit={handleSubmit}
            className="space-y-3"
            onClick={(e) => {
              // Keep form clicks local
              if (DEBUG_REPORT_BUTTON) {
                // eslint-disable-next-line no-console
                console.log("[ReportButton] form onClick", {
                  targetTag: e.target?.tagName,
                  targetClass: e.target?.className,
                });
              }
              e.stopPropagation();
            }}
          >
            {/* Reason: custom dropdown, no HTML <select> */}
            <div className="relative">
              <label className="block text-xs font-medium mb-1">
                {t("report.reasonLabel")}
              </label>

              <button
                type="button"
                className="w-full border rounded-lg px-3 py-1.5 text-sm flex items-center justify-between bg-white hover:bg-gray-50"
                onClick={() => {
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] reason button click", {
                      reasonMenuOpen,
                    });
                  }
                  setReasonMenuOpen((prev) => !prev);
                }}
              >
                <span className="truncate">{currentReasonLabel}</span>
                <span className="ml-2 text-xs text-gray-500">▼</span>
              </button>

              {reasonMenuOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-52 overflow-auto">
                  {REASONS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                        reason === key ? "bg-gray-100" : ""
                      }`}
                      onClick={() => handleReasonSelect(key)}
                    >
                      {t(`report.reason.${key}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details (controlled textarea, stubborn focus; value mirrored into ref) */}
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("report.detailsLabel")}
              </label>
              <textarea
                ref={textareaRef}
                key={detailsVersion}
                rows={3}
                className="w-full border rounded-lg px-2 py-1 text-sm resize-vertical"
                placeholder={t("report.detailsHint")}
                value={details}
                onFocus={(e) => {
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] textarea onFocus", {
                      valueLength: e.target.value.length,
                      activeElementTag: document.activeElement?.tagName,
                    });
                  }
                  // Kun fokus on tekstialueella, blur on lähtökohtaisesti ei-toivottu,
                  // ellei allowBlurRef erikseen kerro muuta.
                }}
                onBlur={(e) => {
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] textarea onBlur", {
                      valueLength: e.target.value.length,
                      activeElementTag: document.activeElement?.tagName,
                      allowBlur: allowBlurRef.current,
                    });
                  }

                  if (allowBlurRef.current) {
                    // Tämä blur on “tarkoituksellinen” (Cancel, kortin sulkeminen tms.).
                    allowBlurRef.current = false;
                    return;
                  }

                  // Muuten palautetaan fokus seuraavassa framessa, jos joku globaali
                  // handleri on vienyt sen BODY:lle tms.
                  const el = textareaRef.current;
                  if (el) {
                    requestAnimationFrame(() => {
                      if (document.activeElement !== el) {
                        try {
                          el.focus();
                        } catch {
                          // ignore
                        }
                      }
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] textarea onKeyDown", {
                      key: e.key,
                      valueLength: e.target.value.length,
                    });
                  }
                  // Keep key events local to the textarea
                  e.stopPropagation();
                  if (
                    e.nativeEvent &&
                    typeof e.nativeEvent.stopImmediatePropagation ===
                      "function"
                  ) {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] textarea onChange", {
                      valueLength: value.length,
                    });
                  }
                  setDetails(value);
                  detailsRef.current = value;
                }}
              />
            </div>

            {status === "ok" && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                {t("report.thanks")}
              </div>
            )}

            {status === "error" && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                {t("report.error")}
                {errorMessage && (
                  <span className="block opacity-80 mt-0.5">
                    {errorMessage}
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50"
                onClick={() => {
                  if (DEBUG_REPORT_BUTTON) {
                    // eslint-disable-next-line no-console
                    console.log("[ReportButton] cancel click");
                  }
                  // Cancel → sallitaan blur, ettei tekstialue roiku väkisin fokuksessa.
                  allowBlurRef.current = true;
                  setReasonMenuOpen(false);
                  setOpen(false);
                }}
                disabled={submitting}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="px-4 py-1 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!reason || submitting}
              >
                {submitting ? t("report.submitting") : t("report.submit")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

ReportButton.propTypes = {
  targetUserId: PropTypes.string,
  messageId: PropTypes.string,
  compact: PropTypes.bool,
};

ReportButton.defaultProps = {
  targetUserId: undefined,
  messageId: undefined,
  compact: false,
};

export default ReportButton;
// --- REPLACE END ---


