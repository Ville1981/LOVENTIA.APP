// --- REPLACE START: full file with i18n integration for all texts ---
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";
import { BACKEND_BASE_URL } from "../config";

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t("settings.deleteConfirm"))) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/users/${user._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        console.error(t("settings.deleteErrorConsole"), res.status);
        alert(t("settings.deleteErrorAlert"));
        return;
      }

      logout();
      navigate("/");
    } catch (err) {
      console.error(t("settings.deleteErrorConsole"), err);
      alert(t("settings.deleteErrorAlert"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <ControlBar>
        <Button onClick={() => navigate(-1)} variant="secondary">
          {t("buttons.back")}
        </Button>
      </ControlBar>

      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>

      <div className="border border-red-300 bg-red-50 p-4 rounded-lg space-y-2">
        <h2 className="text-xl font-semibold text-red-700">
          {t("settings.dangerTitle")}
        </h2>
        <p className="text-sm text-red-600">{t("settings.dangerDescription")}</p>
        <Button
          onClick={handleDelete}
          disabled={isDeleting}
          variant="danger"
        >
          {isDeleting ? t("messages.loading") : t("settings.deleteButton")}
        </Button>
      </div>
    </div>
  );
}
// --- REPLACE END ---
