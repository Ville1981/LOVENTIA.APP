import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
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
 * - Single-photo add with cropping and caption
 * - Bulk upload for multiple images
 * - Display of existing images with "Remove picture" action
 */
export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const maxSlots = isPremium ? 20 : 6;

  // --- state hooks ---
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState('');
  const [slot, setSlot] = useState(0);
  const [localImages, setLocalImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );

  // --- ref hooks ---
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  // --- sync props to state ---
  useEffect(() => {
    const padded = Array.from(
      { length: maxSlots },
      (_, i) => extraImages[i] || null
    );
    setLocalImages(padded);
  }, [extraImages, maxSlots]);

  useEffect(() => {
    if (step > 1) window.scrollTo(0, 0);
  }, [step]);

  // --- helpers ---
  const findFirstEmpty = useCallback(() => {
    const idx = localImages.findIndex((img) => !img);
    return idx !== -1 ? idx : 0;
  }, [localImages]);

  const openSlot = useCallback((idx) => {
    setSlot(idx);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, []);

  // --- single-photo flow handlers ---
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

  const handleSubmit = async () => {
    if (!userId) {
      console.error('uploadPhotoStep: userId is undefined!');
      return;
    }
    if (!selectedFile || !croppedAreaPixels) return;
    try {
      const form = new FormData();
      form.append('photo', selectedFile);
      form.append('slot', slot.toString());
      form.append('cropX', croppedAreaPixels.x.toString());
      form.append('cropY', croppedAreaPixels.y.toString());
      form.append('cropWidth', croppedAreaPixels.width.toString());
      form.append('cropHeight', croppedAreaPixels.height.toString());
      if (caption) form.append('caption', caption);

      const result = await uploadPhotoStep(userId, form);
      if (result?.extraImages) {
        const padded = Array.from(
          { length: maxSlots },
          (_, i) => result.extraImages[i] || null
        );
        setLocalImages(padded);
      }
      onSuccess(result);
      // reset
      setStep(1);
      setSelectedFile(null);
      setCaption('');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setSlot(findFirstEmpty());
    } catch (err) {
      onError(err);
    }
  };

  // --- bulk-upload handlers ---
  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
  };
  const handleBulkUpload = async () => {
    if (!userId) {
      console.error('uploadPhotos: userId is undefined!');
      return;
    }
    if (!bulkFiles.length) return;
    try {
      const form = new FormData();
      // Preserve existing images to avoid orphaning
      localImages.forEach((img) => {
        if (img) {
          const url = img.startsWith('http')
            ? img
            : `${BACKEND_BASE_URL}${img}`;
          form.append('existing[]', url);
        }
      });
      // Append new files
      bulkFiles.forEach((file) => {
        form.append('photos[]', file);
      });

      const result = await uploadPhotos(userId, form);
      if (result?.extraImages) {
        const padded = Array.from(
          { length: maxSlots },
          (_, i) => result.extraImages[i] || null
        );
        setLocalImages(padded);
      }
      onSuccess(result);
      // reset bulk files and input
      setBulkFiles([]);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    } catch (err) {
      onError(err);
    }
  };

  // --- delete slot ---
  const handleDelete = async (i) => {
    if (!userId) {
      console.error('deletePhotoSlot: userId is undefined!');
      return;
    }
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
      {/* Bulk-upload controls */}
      <div className="mb-4 flex items-center space-x-2">
        <label
          htmlFor="bulk-input"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
        >
          Add photos
        </label>
        <input
          id="bulk-input"
          type="file"
          multiple
          accept="image/*"
          ref={bulkInputRef}
          onChange={handleBulkChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={!bulkFiles.length}
          onClick={handleBulkUpload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Save photos
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

      {/* Image slots - show only existing images */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {localImages
          .map((src, i) => ({ src, i }))
          .filter(item => item.src)
          .map(({ src, i }) => (
            <div key={i} className="flex flex-col items-center">
              <div className="border p-2 flex items-center justify-center w-32 h-32 bg-gray-100 hover:bg-gray-200">
                <img
                  src={src.startsWith('http') ? src : `${BACKEND_BASE_URL}${src}`}
                  alt={`Slot ${i + 1}`}
                  className="object-cover w-full h-full"
                />
              </div>
              <button
                type="button"
                onClick={() => handleDelete(i)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Remove picture
              </button>
            </div>
          ))
        }
      </div>

      {/* Modal for single-photo cropping & caption */}
      {step > 1 && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold mb-4">Preview Image</h2>
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
            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold mb-4">Crop Image</h2>
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
            {step === 4 && (
              <>
                <h2 className="text-lg font-semibold mb-2">Add Caption</h2>
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
            <div className="flex justify-between mt-4">
              {step > 2 && (
                <button onClick={handleBack} className="px-3 py-1 bg-gray-200 rounded">
                  Back
                </button>
              )}
              {step < 4 && (
                <button onClick={handleNext} className="px-3 py-1 bg-gray-200 rounded">
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

MultiStepPhotoUploader.propTypes = {
  userId: PropTypes.string.isRequired,
  isPremium: PropTypes.bool,
  extraImages: PropTypes.arrayOf(PropTypes.string),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

MultiStepPhotoUploader.defaultProps = {
  isPremium: false,
  extraImages: [],
  onSuccess: () => {},
  onError: () => {},
};
