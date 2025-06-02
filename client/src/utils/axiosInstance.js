import axios from "axios";

let accessToken = localStorage.getItem("token"); // Vanhasta tallennuksesta

export const setAccessToken = (token) => {
  accessToken = token;
};

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true, // ✅ Tarvitaan cookieiden käyttöön!
});

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshRes = await axios.post(
          "http://localhost:5000/api/auth/refresh",
          {},
          { withCredentials: true }
        );

        accessToken = refreshRes.data.accessToken;
        setAccessToken(accessToken); // Päivitä token

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest); // Retry alkuperäinen pyyntö
      } catch (refreshError) {
        console.error("Refresh token epäonnistui:", refreshError);
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
