import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/axiosInstance";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation
    if (password !== confirmPassword) {
      setMessage("Salasanat eivät täsmää");
      return;
    }
    if (password.length < 8) {
      setMessage("Salasanan tulee olla vähintään 8 merkkiä pitkä");
      return;
    }

    try {
      // 1. Luo käyttäjä /api/auth/register
      await api.post("/auth/register", {
        username,
        email,
        password,
      });

      // 2. Kirjaudu heti: /api/auth/login
      const loginRes = await api.post("/auth/login", {
        email,
        password,
      });

      // 3. Tallenna access token kontekstiin ja localStorageen
      login(loginRes.data.accessToken);

      // 4. Ilmoita ja siirry profiilisivulle
      setMessage("Tili luotu ja kirjautuminen onnistui!");
      navigate("/profile");
    } catch (err) {
      // Näytä backendin antama virheilmoitus tai yleinen
      const errMsg = err.response?.data?.error;
      setMessage(errMsg || "Virhe rekisteröinnissä");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 space-y-4 bg-white p-6 rounded shadow"
    >
      <h2 className="text-xl font-bold">Rekisteröidy</h2>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Käyttäjänimi"
        className="w-full border p-2 rounded"
        required
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Sähköposti"
        className="w-full border p-2 rounded"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Salasana"
        className="w-full border p-2 rounded"
        required
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Vahvista salasana"
        className="w-full border p-2 rounded"
        required
      />
      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        disabled={!username || !email || !password || !confirmPassword}
      >
        Luo tili
      </button>
      {message && (
        <p className="text-sm text-red-600">{message}</p>
      )}
    </form>
  );
};

export default Register;
