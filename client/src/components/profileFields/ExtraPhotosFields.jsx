// client/src/components/profileFields/ExtraPhotosFields.jsx

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { BACKEND_BASE_URL } from "../../config";

const ExtraPhotosFields = ({
  userId,
  isPremium,
  extraImages = [],
  onSuccess,
  onError,
}) => {
  // JWT-token haettuna localStoragesta
  const token = localStorage.getItem("token");

  // Määritä kuvien maksimi määrä roolin mukaan
  const maxSlots = isPremium ? 20 : 6;

  // Tiedostot ja esikatselujen tilat
  const [files, setFiles] = useState(Array(maxSlots).fill(null));
  const [previews, setPreviews] = useState(
    Array.from({ length: maxSlots }, (_, i) => {
      const img = extraImages[i];
      return img
        ? img.startsWith("http")
          ? img
          : `${BACKEND_BASE_URL}/${img}`
        : null;
    })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Päivitä esikatselut kun extraImages-propsi muuttuu
  useEffect(() => {
    setPreviews(
      Array.from({ length: maxSlots }, (_, i) => {
        const img = extraImages[i];
        return img
          ? img.startsWith("http")
            ? img
            : `${BACKEND_BASE_URL}/${img}`
          : null;
      })
    );
    setFiles(Array(maxSlots).fill(null));
  }, [extraImages, maxSlots]);

  // Ref piilotetulle tiedosto-inputille
  const hiddenFileInputRef = useRef(null);

  // Käyttäjä klikkaa "Lisää kuva" -nappia
  const handleAddClick = () => {
    hiddenFileInputRef.current?.click();
  };

  // Kun tiedosto valitaan, lisätään ensimmäiseen vapaaseen slotiin
  const handleAddFile = (e) => {
    const file = e.target.files[0] || null;
    if (!file) return;

    const slotIdx = previews.findIndex((p) => p === null);
    if (slotIdx === -1) return; // Ei vapaata slotia

    const newFiles = [...files];
    newFiles[slotIdx] = file;
    setFiles(newFiles);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const newPreviews = [...previews];
      newPreviews[slotIdx] = ev.target.result;
      setPreviews(newPreviews);
    };
    reader.readAsDataURL(file);

    // Tyhjennä valinta, jotta samaa tiedostoa voi valita uudelleen
    e.target.value = "";
  };

  // Lomakkeen submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.every((f) => !f)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    files.forEach((file) => {
      if (file) formData.append("photos", file);
    });

    try {
      const res = await axios.post(
        `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const updatedUser = res.data.user || res.data;
      onSuccess(updatedUser);
    } catch (err) {
      console.error(err);
      setSubmitError("Lisäkuvien tallennus epäonnistui");
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow rounded-lg p-6 mb-6 space-y-4"
    >
      <h3 className="text-lg font-semibold">Lisäkuvat</h3>

      {/* Piilotettu tiedosto-input */}
      <input
        type="file"
        accept="image/*"
        ref={hiddenFileInputRef}
        onChange={handleAddFile}
        className="hidden"
      />

      {/* Lisää kuva -nappi */}
      <button
        type="button"
        onClick={handleAddClick}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        📸 Lisää kuva
      </button>

      {/* Kuvien esikatselut */}
      <div className="grid grid-cols-3 gap-4">
        {previews.map((src, idx) => (
          <div
            key={idx}
            className="w-full h-24 bg-gray-100 rounded overflow-hidden"
          >
            {src ? (
              <img
                src={src}
                alt={`Lisäkuva ${idx + 1}`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.png";
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                + {idx + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tallenna lisäkuvat -nappi */}
      <button
        type="submit"
        disabled={files.every((f) => !f) || isSubmitting}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? "Tallennetaan..." : "💾 Tallenna lisäkuvat"}
      </button>

      {submitError && <p className="text-red-600">{submitError}</p>}
    </form>
  );
};

export default ExtraPhotosFields;
