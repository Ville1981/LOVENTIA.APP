import React, { useEffect, useState } from "react";

import api from "../utils/axiosInstance";

const AdBanner = () => {
  // oletuksena true, jotta premium-käyttäjälle ei näytetä mainosta
  const [isPremium, setIsPremium] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // interceptor hoitaa Authorization-headerin
        const res = await api.get("/users/me");
        setIsPremium(res.data.isPremium);
      } catch (err) {
        console.error("Käyttäjätietojen haku epäonnistui", err);
      }
    };

    fetchUser();
  }, []);

  // jos premium, ei näytetä banneria
  if (isPremium) return null;

  return (
    <div className="bg-yellow-100 border border-yellow-300 p-4 rounded shadow-md text-center mt-6">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">🎯 Mainos</h3>
      <img
        src="/mainosbanneri.jpg"
        alt="Mainos"
        className="mx-auto h-32 object-contain"
      />
      <p className="mt-2 text-sm text-yellow-700">
        Osta silmälasit nyt -50% alennuksella!
      </p>
    </div>
  );
};

export default AdBanner;
