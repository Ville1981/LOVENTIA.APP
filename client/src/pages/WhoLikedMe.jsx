import React, { useEffect, useState } from 'react';
import api from '../utils/axiosInstance';

const WhoLikedMe = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWhoLikedMe = async () => {
      try {
        // Interceptor hoitaa Authorization-headerin
        const res = await api.get('/auth/who-liked-me');
        setUsers(res.data);
      } catch (err) {
        console.error('Virhe haettaessa tykkäyksiä:', err.response?.data || err);
        if (err.response?.status === 403) {
          setError('❌ Tämä ominaisuus on vain Premium-käyttäjille.');
        } else {
          setError('Virhe ladattaessa tykkäyksiä.');
        }
      }
    };

    fetchWhoLikedMe();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4 text-center">👀 Ketkä tykkäsivät sinusta</h2>

      {error && <p className="text-center text-red-500">{error}</p>}

      {!error && users.length === 0 && (
        <p className="text-center text-gray-600">Ei vielä tykkäyksiä.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user._id} className="bg-white p-4 rounded shadow-md text-center">
            <img
              src={
                user.profilePicture
                  ? `http://localhost:5000/${user.profilePicture}`
                  : '/default.jpg'
              }
              alt={user.name || 'Profiilikuva'}
              className="w-full h-48 object-cover rounded mb-3"
            />
            <h3 className="text-lg font-bold">{user.name || 'Nimetön'}</h3>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhoLikedMe;
