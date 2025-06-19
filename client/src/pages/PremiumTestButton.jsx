import React from "react";
import api from "../utils/axiosInstance";

const PremiumTestButton = () => {
  const handleUpgrade = async () => {
    try {
      // Lähetetään pyyntö premium-statuksen päivitykseen
      const res = await api.post(
        "/auth/upgrade-premium",
        {}
      );
      alert("✅ Premium aktivoitu: " + (res.data.message || "Onnistui!"));
    } catch (err) {
      console.error("❌ Virhe:", err.response?.data || err);
      alert("❌ Premiumin aktivointi epäonnistui");
    }
  };

  return (
    <div className="mt-6 text-center">
      <button
        onClick={handleUpgrade}
        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
      >
        ⭐ Aktivoi Premium (testi)
      </button>
    </div>
  );
};

export default PremiumTestButton;
