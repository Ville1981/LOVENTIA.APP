// File: client/src/pages/Settings.jsx
// --- REPLACE START: shim that forwards to SettingsPage for backwards compatibility ---
import React from "react";
import SettingsPage from "./SettingsPage";

/**
 * Thin shim component so that any legacy imports of `Settings`
 * keep working. The real implementation now lives in SettingsPage.
 */
export default function Settings(props) {
  return <SettingsPage {...props} />;
}
// --- REPLACE END ---


