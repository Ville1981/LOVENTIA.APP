import React, { useEffect, useState } from "react";
import api from "../utils/axiosInstance";
import { useTranslation } from "react-i18next";

const PremiumSuccess = () => {
  const { t } = useTranslation();
  const [message, setMessage] = useState(t("premium.updating"));
  const token = localStorage.getItem("token");

  useEffect(() => {
    const updatePremium = async () => {
      try {
        // Lähetetään päivityspyyntö premium-statuksen nostamiseksi
        await api.post(
          "/auth/upgrade-premium",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setMessage(t("premium.successMessage"));
      } catch (err) {
        console.error("Premium-päivitys epäonnistui", err);
        setMessage(t("premium.errorMessage"));
      }
    };

    updatePremium();
  }, [t]);

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-4">⭐ {t("premium.successTitle")}</h1>
      <p>{message}</p>
    </div>
  );
};

export default PremiumSuccess;
