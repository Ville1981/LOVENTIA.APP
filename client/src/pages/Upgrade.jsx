// client/src/pages/Upgrade.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Upgrade = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    // Redirect to subscription/payment flow
    navigate('/settings/subscriptions');
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Kirjaudu sisään</h1>
        <p className="mb-4">
          Jotta näet Premium-edut ja voit liittyä Premiumiksi, kirjaudu sisään.
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Kirjaudu sisään
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Siirry Premiumiksi</h1>
      <ul className="list-disc list-inside space-y-2 text-lg">
        <li>🔍 Näe, kuka on tykännyt sinusta</li>
        <li>⭐ 3 SuperTykkäystä viikossa</li>
        <li>❓ Kaikki kysymysvastaukset näkyvissä</li>
        <li>❤️ Rajoittamaton tykkäys</li>
        <li>🚫 Dealbreakers-toiminto</li>
        <li>⏪ Rajoittamattomat uudelleenkyselyt</li>
        <li>📩 Unlock Intros -viestit</li>
        <li>🚫 Ei mainoksia</li>
      </ul>
      <button
        onClick={handleUpgrade}
        className="mt-6 w-full py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition"
      >
        Liity Premiumiksi
      </button>
    </div>
  );
};

export default Upgrade;
