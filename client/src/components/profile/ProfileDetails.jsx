import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Backendin perus-URL, päivitä tarvittaessa omaksesi
const BACKEND_BASE_URL = 'http://localhost:5000';

/**
 * ProfileDetails
 *
 * Tämä komponentti hoitaa vanhojen profiilikenttien muokkauksen.
 * Props:
 *  - user: käyttäjädata, sisältää user.id ja user.profile
 *  - onUpdate: callback, johon päivitetty käyttäjädata palautetaan
 */
const ProfileDetails = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState({
    aboutMe: '',
    currentGoal: '',
    talents: '',
    // …lisää tähän muut kentät, esim. traits, hobbies jne.
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Esitäytetään lomake backendistä haetulla profiilidatalla
    if (user.profile) {
      setFormData({
        aboutMe: user.profile.aboutMe || '',
        currentGoal: user.profile.currentGoal || '',
        talents: user.profile.talents || '',
        // …esitäytä muut kentät samalla tavalla
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.put(`${BACKEND_BASE_URL}/api/profile/${user.id}`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      onUpdate(response.data);
    } catch (err) {
      console.error('Profiilin päivittäminen epäonnistui:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
      <h3 className="text-lg font-semibold">Profiilitiedot</h3>

      <div>
        <label className="block font-medium">About Me</label>
        <textarea
          name="aboutMe"
          value={formData.aboutMe}
          onChange={handleChange}
          className="w-full border rounded p-2"
          rows={4}
        />
      </div>

      <div>
        <label className="block font-medium">Current Goal</label>
        <input
          type="text"
          name="currentGoal"
          value={formData.currentGoal}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block font-medium">Talents</label>
        <input
          type="text"
          name="talents"
          value={formData.talents}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />
      </div>

      {/* Lisää mahdolliset muut kentät tähän samaan tapaan */}

      <button type="submit" disabled={loading} className="bg-blue-600 text-white py-2 px-4 rounded">
        {loading ? 'Tallennetaan…' : 'Tallenna profiili'}
      </button>
    </form>
  );
};

export default ProfileDetails;
