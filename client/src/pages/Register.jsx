import { useState } from "react";
import axios from "axios";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Luo käyttäjä
      const res = await axios.post("http://localhost:5000/api/auth/register", {
        username,
        email,
        password,
      });

      // 2. Kirjaudu heti luodulla tunnuksella
      const loginRes = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      // 3. Tallenna token localStorageen
      localStorage.setItem("token", loginRes.data.token);

      // 4. Ohjaa profiilin täyttöön
      setMessage("Tili luotu ja kirjautuminen onnistui!");
      window.location.href = "/profile";

    } catch (err) {
      setMessage(err.response?.data?.error || "Virhe rekisteröinnissä");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 space-y-4 bg-white p-6 rounded shadow">
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
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        Luo tili
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
};

export default Register;
