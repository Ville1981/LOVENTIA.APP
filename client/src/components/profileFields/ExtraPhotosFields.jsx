// client/src/components/profileFields/ExtraPhotosFields.jsx

import React, { useState, useEffect } from "react";
import { uploadPhotos } from "../../api/images";
import { BACKEND_BASE_URL } from "../../config";

const ExtraPhotosFields = ({
  userId,
  isPremium,
  extraImages = [],
  onSuccess,
  onError,
}) => {
  const maxSlots = isPremium ? 12 : 3;

  // Tiedostot ja esikatselut
  const [files, setFiles] = useState(Array(maxSlots).fill(null));
  const [previews, setPreviews] = useState(
    Array.from({ length: maxSlots }, (_, i) => {
      const img = extraImages[i];
      if (img) {
        return img.startsWith("http")
          ? img
          : `${BACKEND_BASE_URL}/${img}`;
      }
      return null;
    })
  );

  // Kun palvelimen kuvat muuttuvat
  useEffect(() => {
    setPreviews(
      Array.from({ length: maxSlots }, (_, i) => {
        const img = extraImages[i];
        if (img) {
          return img.startsWith("http")
            ? img
            : `${BACKEND_BASE_URL}/${img}`;
        }
        return null;
      })
    );
  }, [extraImages, maxSlots]);

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
      if (file) formData.append("extraPhotos", file);
    });

    try {
      const updatedUser = await uploadPhotos(userId, formData);
      onSuccess(updatedUser);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Lisäkuvat</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {previews.map((src, idx) => (
          <div key={idx} className="w-full h-24 bg-gray-100 relative">
            {src && (
              <img
                src={src}
                alt={`Lisäkuva ${idx + 1}`}
                className="object-cover w-full h-full"
                onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, idx)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        ))}
      </div>
      <button
        type="submit"
        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
      >
        💾 Tallenna lisäkuvat
      </button>
    </form>
  );
};

export default ExtraPhotosFields;
