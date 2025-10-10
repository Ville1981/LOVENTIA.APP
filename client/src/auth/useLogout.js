// PATH: client/src/auth/useLogout.js
// --- REPLACE START ---
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Yhteinen axios-instanssi (muuta polku jos sinulla on oma instanssi)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000',
  withCredentials: true,
});

// Pieni apuri, ettei jää tyhjiä catch-lohkoja
function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug(`safeRemove(${key}) failed`, err);
    return false;
  }
}

export function useLogout({ setAuth } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  return async function logout() {
    try {
      await api.post('/api/auth/logout'); // 200/204 riittää, bodya ei tarvita
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('logout: server call failed (ignored)', err);
    }

    // 1) Poista tokenit kaikista paikoista
    safeRemove(localStorage, 'accessToken');
    safeRemove(sessionStorage, 'accessToken');
    safeRemove(localStorage, 'user');

    // 2) Poista mahdollinen globaali Authorization-header
    delete axios.defaults.headers.common?.Authorization;
    delete api.defaults?.headers?.common?.Authorization;

    // 3) Nollaa oma auth-store (passaa setAuth propina jos käytät sellaista)
    if (typeof setAuth === 'function') setAuth({ user: null, token: null });

    // 4) Tyhjennä React Query -cache (jos käytössä)
    try {
      await qc.clear();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('react-query clear failed (ignored)', err);
    }

    // 5) Navigoi kirjautumissivulle
    navigate('/login', { replace: true });
  };
}
// --- REPLACE END ---
