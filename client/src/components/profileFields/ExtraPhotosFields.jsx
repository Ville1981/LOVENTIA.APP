// src/components/profileFields/ExtraPhotosFields.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Props:
// - user: objekti, sisältää extraImages[] ja isPremium
// - token: autentikointitoken
// - onSuccess: callback päivityksen onnistuttua
// - onError: callback virhetilanteessa
const ExtraPhotosFields = ({ user, token, onSuccess, onError }) => {
  const BACKEND_BASE_URL = 'http://localhost:5000';
  const maxSlots = user.isPremium ? 20 : 6;

  // Tiedostot ja esikatselut tilassa
  const [files, setFiles] = useState(Array(maxSlots).fill(null));
  const [previews, setPreviews] = useState(
    Array.from({ length: maxSlots }, (_, i) =>
      user.extraImages && user.extraImages[i]
        ? user.extraImages[i].startsWith('http')
          ? user.extraImages[i]
          : `${BACKEND_BASE_URL}/${user.extraImages[i]}`
        : null
    )
  );

  // Päivittää esikatselut, kun user.extraImages muuttuu
  useEffect(() => {
    setPreviews(
      Array.from({ length: maxSlots }, (_, i) =>
        user.extraImages && user.extraImages[i]
          ? user.extraImages[i].startsWith('http')
            ? user.extraImages[i]
            : `${BACKEND_BASE_URL}/${user.extraImages[i]}`
          : null
      )
    );
  }, [user.extraImages, maxSlots]);

  const handleFileChange = (e, idx) => {
    const file = e.target.files[0] || null;
    const newFiles = [...files];
    newFiles[idx] = file;
    setFiles(newFiles);

    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newPreviews = [...previews];
        newPreviews[idx] = ev.target.result;
        setPreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    files.forEach((file) => {
      if (file) formData.append('extraImages', file);
    });

    try {
      const res = await axios.put(
        `${BACKEND_BASE_URL}/api/users/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      onSuccess(res.data);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-semibold">
        {user.isPremium ? 'Lisäkuvat (max 20)' : 'Lisäkuvat (max 6)'}
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: maxSlots }).map((_, idx) => (
          <div
            key={idx}
            className="border rounded overflow-hidden relative bg-gray-100 h-32"
          >
            <img
              loading="lazy"
              src={previews[idx] || '/images/placeholder.png'}
              alt={`Lisäkuva ${idx + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/images/placeholder.png';
              }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, idx)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        ))}
      </div>
      <div className="pt-6 flex justify-center">
        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          💾 Tallenna lisäkuvat
        </button>
      </div>
    </form>
  );
};

export default ExtraPhotosFields;
