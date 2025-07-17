<<<<<<< HEAD
// src/pages/Login.jsx

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
=======
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
import api from '../utils/axiosInstance';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
<<<<<<< HEAD
    setMessage('');
    try {
      // send login request
      const res = await api.post('/auth/login', { email, password });
      // backend sets refresh-token in HttpOnly cookie,
      // frontend stores access-token in AuthContext
      login(res.data.accessToken);
      setMessage('Login successful!');
      navigate('/profile');
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
        'Login failed. Please check your credentials.'
      );
=======
    try {
      // Lähetetään kirjautumispyyntö
      const res = await api.post('/auth/login', { email, password });
      // Backend asettaa refresh-tokenin HttpOnly-cookiessa,
      // frontti tallentaa vain access-tokenin AuthContextiin
      login(res.data.accessToken);
      setMessage('Kirjautuminen onnistui!');
      navigate('/profile');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Virhe kirjautumisessa');
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    }
  };

  return (
<<<<<<< HEAD
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Log In</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Log In
        </button>
      </form>

      {/* Forgot password link */}
      <div className="mt-4 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      {message && (
        <p
          className={`mt-4 text-center ${
            message.toLowerCase().includes('successful')
              ? 'text-green-600'
              : 'text-red-600'
=======
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 space-y-4 bg-white p-6 rounded shadow"
    >
      <h2 className="text-xl font-bold">Kirjaudu sisään</h2>
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
      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
      >
        Kirjaudu
      </button>
      {message && (
        <p
          className={`text-sm text-center ${
            message.includes('onnistui') ? 'text-green-600' : 'text-red-600'
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
          }`}
        >
          {message}
        </p>
      )}
<<<<<<< HEAD
    </div>
=======
    </form>
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
  );
};

export default Login;
