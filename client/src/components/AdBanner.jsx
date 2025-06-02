import React, { useEffect, useState } from "react";
import axios from "axios";

const AdBanner = () => {
  const [isPremium, setIsPremium] = useState(true); // oletetaan ensin ettei näytetä

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setIsPremium(res.data.isPremium);
      } catch (err) {
        console.error("Käyttäjätietojen haku epäonnistui", err);
      }
    };

    fetchUser();
  }, []);

  if (isPremium) return null; // älä näytä mainosta premium-käyttäjälle

  return (
    <div className="bg-yellow-100 border border-yellow-300 p-4 rounded shadow-md text-center mt-6">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">🎯 Mainos</h3>
      <img
        src="/mainosbanneri.jpg"
        alt="Mainos"
        className="mx-auto h-32 object-contain"
      />
      <p className="mt-2 text-sm text-yellow-700">Osta silmälasit nyt -50% alennuksella!</p>
    </div>
  );
};

export default AdBanner;
