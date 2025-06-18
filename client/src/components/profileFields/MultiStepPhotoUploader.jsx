// src/components/profileFields/MultiStepPhotoUploader.jsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  uploadPhotoStep,
  deletePhotoSlot,
  uploadPhotos,
} from '../../api/images';
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config';

/**
 * MultiStepPhotoUploader manages extra photo slots including:
 * - Single photo add with cropping and caption
 * - Bulk upload for multiple images
 * - Display of existing images with "Remove picture" action
 */
export default function MultiStepPhotoUploader({
  userId,
  isPremium,
  extraImages = [],
  onSuccess,
  onError,
}) {
  const maxSlots = isPremium ? 20 : 6;

  // Step state for single-photo flow
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);

  // Bulk-upload state
  const [bulkFiles, setBulkFiles] = useState([]);

  // Crop + caption state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState('');

  // Current slot index for single-photo flow
  const [slot, setSlot] = useState(0);

  // Local images padded to maxSlots
  const [localImages, setLocalImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );

  // Sync when extraImages prop changes
  useEffect(() => {
    const padded = Array.from(
      { length: maxSlots },
      (_, i) => extraImages[i] || null
    );
    setLocalImages(padded);
  }, [extraImages, maxSlots]);

  // Reset scroll when modal opens
  useEffect(() => {
    if (step > 1) window.scrollTo(0, 0);
  }, [step]);

  const fileInputRef = useRef(null);

  // Helpers
  const findFirstEmpty = useCallback(() => {
    const idx = localImages.findIndex((img) => !img);
    return idx !== -1 ? idx : 0;
  }, [localImages]);

  const openSlot = useCallback((idx) => {
    setSlot(idx);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, []);

  // Handlers
  const handleAddClick = useCallback(() => {
    openSlot(findFirstEmpty());
  }, [findFirstEmpty, openSlot]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep(2);
    }
  }, []);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, 4));
  }, []);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  // Bulk file selection
  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
  };

  // Bulk upload submit
  const handleBulkUpload = async () => {
    if (!bulkFiles.length || !userId) return;
    try {
      const result = await uploadPhotos(userId, bulkFiles);
      if (result?.extraImages) {
        const padded = Array.from(
          { length: maxSlots },
          (_, i) => result.extraImages[i] || null
        );
        setLocalImages(padded);
      }
      onSuccess(result);
      setBulkFiles([]);
    } catch (err) {
      onError(err);
    }
  };

  // Single-photo final submit
  const handleSubmit = async () => {
    if (!userId || !selectedFile || !croppedAreaPixels) return;
    const form = new FormData();
    form.append('photo', selectedFile);
    form.append('slot', slot);
    form.append('cropX', croppedAreaPixels.x);
    form.append('cropY', croppedAreaPixels.y);
    form.append('cropWidth', croppedAreaPixels.width);
    form.append('cropHeight', croppedAreaPixels.height);
    if (caption) form.append('caption', caption);

    try {
      const result = await uploadPhotoStep(userId, form);
      if (result?.extraImages) {
        const padded = Array.from(
          { length: maxSlots },
          (_, i) => result.extraImages[i] || null
        );
        setLocalImages(padded);
      }
      onSuccess(result);
      // Reset flow
      setStep(1);
      setSelectedFile(null);
      setCaption('');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (err) {
      onError(err);
    }
  };

  // Delete photo slot
  const handleDelete = async (i) => {
    if (!userId) return;
    try {
      const result = await deletePhotoSlot(userId, i);
      if (result?.extraImages) {
        const padded = Array.from(
          { length: maxSlots },
          (_, idx) => result.extraImages[idx] || null
        );
        setLocalImages(padded);
      }
      onSuccess(result);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div>
      {/* Add single photo & bulk upload controls */}
      <button
        type="button"
        onClick={handleAddClick}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Add Photo
      </button>
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
          disabled={!bulkFiles.length}
          onClick={handleBulkUpload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Save Photos
        </button>
      </div>

      {/* Hidden input for single-photo flow */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Image slots grid */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {localImages.map((src, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              onClick={() => !src && openSlot(i)}
              className="border p-2 cursor-pointer flex items-center justify-center w-32 h-32 bg-gray-100 hover:bg-gray-200"
            >
              <img
                src={src ? `${BACKEND_BASE_URL}${src}` : PLACEHOLDER_IMAGE}
                alt={src ? `Slot ${i + 1}` : `Empty slot ${i + 1}`}
                className={`${
                  !src ? 'opacity-50' : ''
                } object-cover w-full h-full`}
              />
            </div>
            {src && (
              <button
                type="button"
                onClick={() => handleDelete(i)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Remove picture
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal for single-photo cropping & caption */}
      {step > 1 && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            {/* Preview */}
            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold mb-4">
                  Preview Image
                </h2>
                <div className="relative w-full h-64 bg-gray-200 flex items-center justify-center">
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Proceed to crop next.
                </p>
              </>
            )}
            {/* Crop */}
            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold mb-4">
                  Crop Image
                </h2>
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
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </>
            )}
            {/* Caption & Submit */}
            {step === 4 && (
              <>
                <h2 className="text-lg font-semibold mb-2">
                  Add Caption
                </h2>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Optional caption"
                  className="w-full border rounded p-2"
                />
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
            {/* Navigation */}
            <div className="flex justify-between mt-4">
              {step > 2 && (
                <button
                  onClick={handleBack}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  Back
                </button>
              )}
              {step < 4 && (
                <button
                  onClick={handleNext}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
