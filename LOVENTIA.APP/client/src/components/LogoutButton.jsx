import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

/**
 * LogoutButton component that triggers user logout flow.
 */
export default function LogoutButton() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      aria-label={t('Logout', 'Logout')}
    >
      {t('Logout', 'Logout')}
    </button>
  );
}

// This is a new component; replace your existing logout link/button with this component where needed.
