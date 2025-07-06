import axios from "axios";

// Alustetaan accessToken joko localStoragesta tai nulliksi
let accessToken = localStorage.getItem("token") || null;

/**
 * Päivittää sisäisen accessToken-muuttujan
 * ja tallentaa sen localStorageen.
 * Kutsutaan esim. login-funktion jälkeen ja refresh-vastauksen jälkeen.
 */
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Luo Axios-instanssi: kehityksessä käyttää Vite-proxya ("/api"), tuotannossa tarvittaessa VITE_API_URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // lähettää ja vastaanottaa httpOnly-cookiet
});

// --- Request interceptor: lisätään Authorization-header ---------------------------------
api.interceptors.request.use(
  (config) => {
    const token = accessToken || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response interceptor: jos 401, yritä refresh ja uudelleenlähetä alkuperäinen pyyntö -----
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        // Kutsutaan refresh-endpointia samaan instanssiin (polku /api/auth/refresh proxyn kautta)
        const { data } = await api.post("/auth/refresh");

        // Päivitetään token sekä closureen että localStorageen
        setAccessToken(data.accessToken);

        // Lisää header ja toista alkuperäinen pyyntö
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("🔄 Refresh token epäonnistui:", refreshError);
        // Tyhjennetään token ja ohjataan käyttäjä kirjautumissivulle
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
