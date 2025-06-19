import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token);
      setMessage('Kirjautuminen onnistui!');
      navigate('/profile');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Virhe kirjautumisessa');
    }
  };

  return (
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
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
};

export default Login;
