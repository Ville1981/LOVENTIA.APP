// client/src/components/profileFields/ExtraPhotosFields.jsx

import React, { useState, useRef, useEffect } from "react";
import { uploadPhotos } from "../../api/images";
import { BACKEND_BASE_URL } from "../../config";

const ExtraPhotosFields = ({
  userId,
  isPremium,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) => {
  const maxSlots = isPremium ? 20 : 6;

  // Files to upload and their previews
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

  // Refs for each hidden input
  const inputRefs = useRef(
    Array.from({ length: maxSlots }, () => React.createRef())
  );

  // Sync saved extraImages into previews
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
    // clear files where slot now filled
    setFiles((prev) => prev.map((f, i) => (extraImages[i] ? null : f)));
  }, [extraImages, maxSlots]);

  // Open file dialog for slot
  const openSlot = (idx) => {
    inputRefs.current[idx].current.click();
  };

  // On file selected
  const handleFileChange = (e, idx) => {
    const file = e.target.files[0] || null;
    e.target.value = "";
    if (!file) return;
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      setPreviews((prev) => {
        const next = [...prev];
        next[idx] = target.result;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit
  const handleSubmit = async () => {
    const toUpload = files.filter((f) => f instanceof File);
    if (toUpload.length === 0) {
      setSubmitError("Et valinnut kuvaa ladattavaksi.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const updatedUser = await uploadPhotos(userId, toUpload);
      onSuccess(updatedUser);
      setFiles(Array(maxSlots).fill(null));
    } catch (err) {
      console.error(err);
      setSubmitError(err.message || "Lisäkuvien tallennus epäonnistui");
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6 space-y-4">
      <h3 className="text-lg font-semibold">Lisäkuvat</h3>
      <button
        type="button"
        onClick={() => {
          const next = previews.findIndex((p) => p === null);
          if (next !== -1) openSlot(next);
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        disabled={previews.every((p) => p !== null) || isSubmitting}
      >
        📸 Lisää kuva
      </button>
      <div className="grid grid-cols-3 gap-4">
        {previews.map((src, idx) => (
          <div
            key={idx}
            className="relative w-full h-32 bg-gray-100 rounded overflow-hidden cursor-pointer"
            onClick={() => openSlot(idx)}
          >
            {/* Hidden file input */}
            <input
              type="file"
              accept="image/*"
              ref={inputRefs.current[idx]}
              onChange={(e) => handleFileChange(e, idx)}
              className="hidden"
            />
            {src ? (
              <img
                src={src}
                alt={`Lisäkuva ${idx + 1}`}
                className="object-cover w-full h-full"
              />
            ) : (
              <>
                <img
                  src="/placeholder-avatar-male.png"
                  alt="Tyhjää paikkaa kuvaava avatar"
                  className="object-cover w-full h-full opacity-25"
                />
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xl">
                  +
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || files.every((f) => f === null)}
        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? "Tallennetaan..." : "💾 Tallenna lisäkuvat"}
      </button>
      {submitError && <p className="text-red-600 mt-2">{submitError}</p>}
    </div>
  );
};

export default ExtraPhotosFields;
