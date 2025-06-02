import React from "react";
import axios from "axios";

const PremiumTestButton = () => {
  const handleUpgrade = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/upgrade-premium",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert("✅ Premium aktivoitu: " + res.data.message);
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
