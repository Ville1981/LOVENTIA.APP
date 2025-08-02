import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/axiosInstance';
import ProfileForm from '../components/profileFields/ProfileForm';

const UserProfile = () => {
  const { userId: userIdParam } = useParams();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  // Lomakkeen lähettäjäfunktio, stubattavissa Cypressissä
  const handleSubmit = async (data) => {
    try {
      // PUT /users/profile (axiosInstance lisää baseURL=/api)
      await api.put('/users/profile', data);
      setSuccess(true);
      setMessage('Profiilitiedot päivitetty onnistuneesti.');
      // Päivitä local state
      setUser((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error('❌ Päivitys epäonnistui', err);
      setSuccess(false);
      setMessage('Profiilitietojen päivitys epäonnistui.');
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // GET /users/me tai /users/:userId
        const apiPath = userIdParam ? `/users/${userIdParam}` : '/users/me';
        const res = await api.get(apiPath);
        const u = res.data.user || res.data;
        setUser(u);
      } catch (err) {
        console.error('❌ Profiilin haku epäonnistui', err);
        setMessage('Profiilin lataus epäonnistui.');
      }
    };
    fetchUser();
  }, [userIdParam]);

  // Käyttäjän ID avataria varten
  const profileUserId = userIdParam || user?._id;

  if (!user) {
    return (
      <div className="text-center py-8" data-cy="UserProfile__loading">
        <span className="text-gray-600">Ladataan…</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6" data-cy="UserProfile__title">
        👤 {userIdParam ? 'Käyttäjän profiili' : 'Oma profiili'}
      </h2>

      {userIdParam ? (
        <div className="bg-white shadow rounded-lg p-6 space-y-4" data-cy="UserProfile__public">
          <h3 className="text-lg font-semibold">Tietoja käyttäjästä</h3>
          <p>
            <strong>Käyttäjätunnus:</strong> {user.username}
          </p>
          {/* … muut julkiset kentät … */}
        </div>
      ) : (
        <>
          {message && (
            <div
              className={`mb-4 text-center ${success ? 'text-green-600' : 'text-red-600'}`}
              data-cy="UserProfile__message"
            >
              {message}
            </div>
          )}

          <ProfileForm
            userId={profileUserId}
            user={user}
            isPremium={user.isPremium}
            t={(key) => key}
            message={message}
            success={success}
            onUserUpdate={setUser}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
};

export default UserProfile;
