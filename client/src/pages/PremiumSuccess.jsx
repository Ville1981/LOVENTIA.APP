import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

const PremiumSuccess = () => {
  const { t } = useTranslation();
  const [message, setMessage] = useState(t("premium.updating"));

  useEffect(() => {
    const token = localStorage.getItem("token");

    const updatePremium = async () => {
      try {
        await axios.post(
          "http://localhost:5000/api/auth/upgrade-premium",
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
