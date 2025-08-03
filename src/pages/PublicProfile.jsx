import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import api from "../utils/axiosInstance";

const PublicProfile = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Haetaan julkinen profiili api-instanssilla
        const res = await api.get(`/users/${id}`);
        setUser(res.data);
      } catch (err) {
        console.error("Käyttäjän lataus epäonnistui:", err);
      }
    };
    fetchProfile();
  }, [id]);

  if (!user) return <p>Ladataan profiilia...</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">
        {user.name}, {user.age}
      </h1>

      {user.profilePicture && (
        <img
          src={`http://localhost:5000/${user.profilePicture}`}
          alt="Profiilikuva"
          className="w-40 h-40 object-cover rounded-full mx-auto mb-4"
        />
      )}

      {user.extraImages?.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {user.extraImages.map((img, i) => (
            <img
              key={i}
              src={`http://localhost:5000/${img}`}
              alt="Lisäkuva"
              className="w-24 h-24 object-cover rounded"
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <strong>Suhdetila:</strong> {user.status}
        </div>
        <div>
          <strong>Uskonto/arvot:</strong> {user.religion}
        </div>
        <div>
          <strong>Lapsia:</strong> {user.children}
        </div>
        <div>
          <strong>Lemmikkejä:</strong> {user.pets}
        </div>
        <div>
          <strong>Pituus:</strong> {user.height}
        </div>
        <div>
          <strong>Paino:</strong> {user.weight}
        </div>
      </div>

      <div className="mt-4">
        <p>
          <strong>📖 Itsekuvaus:</strong>
          <br />
          {user.summary}
        </p>
        <p className="mt-2">
          <strong>🎯 Tavoitteet:</strong>
          <br />
          {user.goal}
        </p>
        <p className="mt-2">
          <strong>💞 Mitä etsin:</strong>
          <br />
          {user.lookingFor}
        </p>
      </div>
    </div>
  );
};

export default PublicProfile;
