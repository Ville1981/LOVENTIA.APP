// src/components/profileFields/MultiStepPhotoUploader.jsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { uploadPhotoStep, deletePhotoSlot, uploadPhotos } from '../../api/images';
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config';

export default function MultiStepPhotoUploader({
  userId,
  isPremium,
  extraImages = [],
  onSuccess,
  onError
}) {
  // Debug: base URL
  console.log('🏷️ BACKEND_BASE_URL:', BACKEND_BASE_URL);

  const maxSlots = isPremium ? 20 : 6;

  // STEP & FILE STATE
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);

  // Bulk-upload state
  const [bulkFiles, setBulkFiles] = useState([]);

  // Crop + caption state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState('');

  // Which slot are we editing?
  const [slot, setSlot] = useState(null);

  // Local copy of extraImages, padded to maxSlots
  const [localExtraImages, setLocalExtraImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );

  useEffect(() => {
    const padded = Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null);
    console.log('🔄 Sync extraImages → localExtraImages:', padded);
    setLocalExtraImages(padded);
  }, [extraImages, maxSlots]);

  // Reset scroll on modal
  useEffect(() => {
    if (step > 1) window.scrollTo(0, 0);
  }, [step]);

  const fileInputRef = useRef(null);

  // Helpers
  const findFirstEmptySlot = useCallback(() => {
    const idx = localExtraImages.findIndex(src => !src);
    return idx !== -1 ? idx : 0;
  }, [localExtraImages]);

  const openSlot = useCallback(idx => {
    setSlot(idx);
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, []);

  // UI callbacks
  const handleAddClick = useCallback(() => {
    console.log('>> handleAddClick');
    openSlot(findFirstEmptySlot());
  }, [findFirstEmptySlot, openSlot]);

  const handleFileChange = useCallback(e => {
    console.log('>> handleFileChange:', e.target.files);
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStep(2);
    }
  }, []);

  const onCropComplete = useCallback((_, pixels) => {
    if (pixels.width && pixels.height) {
      setCroppedAreaPixels(pixels);
      console.log('>> cropped pixels:', pixels);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (step < 4) setStep(s => s + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(s => s - 1);
  }, [step]);

  // Handle bulk file selection
  const handleBulkChange = e => {
    const files = Array.from(e.target.files || []);
    console.log('>> handleBulkChange:', files);
    setBulkFiles(files);
  };

  // Bulk-upload submit
  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    console.log('🔥 handleBulkUpload files:', bulkFiles);
    try {
      const result = await uploadPhotos(userId, bulkFiles);
      console.log('>> uploadPhotos result:', result);
      if (result?.extraImages) {
        const padded = Array.from({ length: maxSlots }, (_, i) => result.extraImages[i] || null);
        setLocalExtraImages(padded);
      }
      onSuccess(result);
      setBulkFiles([]);
    } catch (err) {
      console.error('>> handleBulkUpload error:', err);
      onError(err);
    }
  };

  // FINAL SUBMIT: single-step upload (crop + caption + slot)
  const handleSubmit = async () => {
    console.log('🔥 handleSubmit at step', step);
    console.log('>> submit slot:', slot, 'file:', selectedFile, 'crop:', croppedAreaPixels, 'caption:', caption);

    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('slot', slot);
    formData.append('cropX', croppedAreaPixels.x);
    formData.append('cropY', croppedAreaPixels.y);
    formData.append('cropWidth', croppedAreaPixels.width);
    formData.append('cropHeight', croppedAreaPixels.height);
    if (caption) formData.append('caption', caption);

    console.log('>> FormData entries:', Array.from(formData.entries()));

    try {
      const result = await uploadPhotoStep(userId, formData);
      console.log('>> uploadPhotoStep result:', result);
      if (result?.extraImages) {
        const padded = Array.from({ length: maxSlots }, (_, i) => result.extraImages[i] || null);
        setLocalExtraImages(padded);
      }
      onSuccess(result);
      resetFlow();
    } catch (err) {
      console.error('>> handleSubmit error:', err);
      onError(err);
    }
  };

  const handleDelete = async idx => {
    console.log('>> handleDelete slot:', idx);
    try {
      const result = await deletePhotoSlot(userId, idx);
      console.log('>> deletePhotoSlot result:', result);
      if (result?.extraImages) {
        const padded = Array.from({ length: maxSlots }, (_, i) => result.extraImages[i] || null);
        setLocalExtraImages(padded);
      }
      onSuccess(result);
    } catch (err) {
      console.error('>> handleDelete error:', err);
      onError(err);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedFile(null);
    setCaption('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  return (
    <div>
      {/* ADD PHOTO button */}
      <button
        type="button"
        onClick={handleAddClick}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Add Photo
      </button>

      {/* BULK UPLOAD: select multiple and save */}
      <div className="mb-4 flex items-center space-x-2">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleBulkChange}
          className="block"
        />
        <button
          type="button"
          disabled={bulkFiles.length === 0}
          onClick={handleBulkUpload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          💾 Tallenna lisäkuvat
        </button>
      </div>

      {/* hidden file input for crop-flow */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* SLOTS GRID */}
      <div className="grid grid-cols-3 gap-4">
        {localExtraImages.map((src, i) => (
          <div key={i} className="relative">
            <div
              onClick={() => !src && openSlot(i)}
              className="border p-2 cursor-pointer flex items-center justify-center h-32 bg-gray-100 hover:bg-gray-200"
            >
              <img
                src={src ? `${BACKEND_BASE_URL}/${src}` : PLACEHOLDER_IMAGE}
                alt={src ? `Slot ${i + 1}` : `Empty slot ${i + 1}`}
                className={`object-cover w-full h-full ${!src ? 'opacity-50' : ''}`}
              />
            </div>
            {src && (
              <button
                type="button"
                onClick={() => handleDelete(i)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                title="Delete photo"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* MODAL STEPS */}
      {step > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            {/* Step 2: Preview */}
            {step === 2 && selectedFile && (
              <>
                <h2 className="text-lg font-semibold mb-4">Preview image</h2>
                <div className="relative w-full h-64 bg-gray-200 flex items-center justify-center">
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Proceed to crop in the next step.
                </p>
              </>
            )}

            {/* Step 3: Crop */}
            {step === 3 && selectedFile && (
              <>
                <h2 className="text-lg font-semibold mb-4">Edit thumbnail</h2>
                <div className="relative w-full h-64 bg-gray-200">
                  <Cropper
                    image={URL.createObjectURL(selectedFile)}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </>
            )}

            {/* Step 4: Caption & Submit */}
            {step === 4 && selectedFile && (
              <>
                <h2 className="text-lg font-semibold mb-2">Add a caption</h2>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Say something about your photo (optional)"
                  className="w-full border rounded p-2 mt-2"
                  rows={3}
                />
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    I’m done
                  </button>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-4">
              {step > 2 && (
                <button onClick={handleBack} className="px-3 py-1 bg-gray-200 rounded">Back</button>
              )}
              {step < 4 && (
                <button onClick={handleNext} className="px-3 py-1 bg-gray-200 rounded">Next</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
