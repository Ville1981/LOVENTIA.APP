// src/components/profileFields/MultiStepPhotoUploader.jsx

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useTranslation } from 'react-i18next';

import {
  uploadAvatar,
  uploadPhotoStep,
  deletePhotoSlot,
  uploadPhotos,
} from '../../api/images';
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config';
import ControlBar from '../ui/ControlBar';
import Button from '../ui/Button';

/**
 * Normalize Windows backslashes (\) → forward slash (/)
 * Ensure single leading slash
 */
const normalizePath = (p = '') =>
  '/' + p.replace(/\\/g, '/').replace(/^\/+/, '');

export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const { t } = useTranslation();

  // Number of extra slots (avatar is slot 0)
  const maxSlots = isPremium ? 50 : 9;

  // --- Cropper workflow state ---
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState('');
  const [activeSlot, setActiveSlot] = useState(null);

  // Bulk upload
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkError, setBulkError] = useState('');

  // Local previews & staged direct uploads
  const [localExtra, setLocalExtra] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );
  const [stagedFiles, setStagedFiles] = useState({});

  // Refs for file inputs
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const slotInputRefs = useRef([]);
  if (slotInputRefs.current.length !== maxSlots) {
    slotInputRefs.current = Array(maxSlots)
      .fill()
      .map((_, i) => slotInputRefs.current[i] || React.createRef());
  }

  // Sync prop changes into localExtra
  useEffect(() => {
    setLocalExtra(
      Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
    );
  }, [extraImages, maxSlots]);

  // Always pre-select first empty slot
  useEffect(() => {
    const idx = localExtra.findIndex(x => !x);
    setActiveSlot(idx !== -1 ? idx + 1 : 1);
  }, [localExtra]);

  const findFirstEmpty = useCallback(() => {
    const idx = localExtra.findIndex((x) => !x);
    return idx !== -1 ? idx + 1 : 1;
  }, [localExtra]);

  /**
   * Open crop flow for a given slot
   */
  const openSlot = useCallback((idx) => {
    setActiveSlot(idx);
    setStep(2);
    setSelectedFile(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setStep(2);
  }, []);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  /**
   * Submit cropped image for avatar or extra slot
   */
  const handleSubmitCrop = async () => {
    if (activeSlot === null || !selectedFile || !croppedAreaPixels) return;

    try {
      if (activeSlot === 0) {
        // AVATAR slot
        const form = new FormData();
        form.append('profilePhoto', selectedFile);
        const { profilePicture } = await uploadAvatar(userId, form);
        onSuccess(profilePicture);
      } else {
        // EXTRA slot → subtract 1 before sending
        const form = new FormData();
        form.append('photo', selectedFile);
        form.append('slot', activeSlot - 1);
        form.append('cropX', croppedAreaPixels.x);
        form.append('cropY', croppedAreaPixels.y);
        form.append('cropWidth', croppedAreaPixels.width);
        form.append('cropHeight', croppedAreaPixels.height);
        if (caption) form.append('caption', caption);

        const { extraImages } = await uploadPhotoStep(userId, form);
        setLocalExtra(extraImages.map((i) => i || null));
        onSuccess(extraImages);
      }
    } catch (err) {
      onError(err);
    } finally {
      setStep(1);
      setSelectedFile(null);
      setCaption('');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setActiveSlot(findFirstEmpty());
    }
  };

  /**
   * Direct save (no crop) for any slot
   */
  const handleSlotSave = async (idx) => {
    const file = stagedFiles[idx];
    if (!file) return;

    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('slot', idx - 1);          // ← subtract 1 here
      form.append('cropX', 0);
      form.append('cropY', 0);
      form.append('cropWidth', file.width || 0);
      form.append('cropHeight', file.height || 0);

      const { extraImages } = await uploadPhotoStep(userId, form);
      setLocalExtra(extraImages.map((i) => i || null));
      onSuccess(extraImages);
      setStagedFiles((prev) => {
        const c = { ...prev };
        delete c[idx];
        return c;
      });
    } catch (err) {
      onError(err);
    }
  };

  /** Bulk upload handlers **/
  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
    setBulkError('');
  };
  const handleBulkUpload = async () => {
    if (!bulkFiles.length) return;
    try {
      const form = new FormData();
      bulkFiles.forEach((f) => form.append('photos', f));
      const { extraImages } = await uploadPhotos(userId, form);
      setLocalExtra(extraImages.map((i) => i || null));
      onSuccess(extraImages);
      setBulkFiles([]);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    } catch (err) {
      setBulkError(err.response?.data?.error || err.message);
      onError(err);
    }
  };

  const handleSlotChange = (idx, e) => {
    const file = e.target.files?.[0] || null;
    setStagedFiles((prev) => ({ ...prev, [idx]: file }));
  };
  const handleDelete = async (idx) => {
    try {
      const { extraImages } = await deletePhotoSlot(userId, idx - 1);  // ← subtract 1 here
      setLocalExtra(extraImages.map((i) => i || null));
      onSuccess(extraImages);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div>
      {/* Hidden crop picker */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      />

      {/* Avatar slot (0) */}
      <div className="border rounded-lg p-4 bg-gray-100 mb-4 flex flex-col items-center">
        <img
          src={
            extraImages[0]
              ? extraImages[0].startsWith('http')
                ? extraImages[0]
                : `${BACKEND_BASE_URL}${normalizePath(extraImages[0])}`
              : PLACEHOLDER_IMAGE
          }
          alt="Avatar"
          className="w-32 h-32 rounded-full object-cover mb-2"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
        />
        <ControlBar className="bg-gray-200">
          <Button variant="orange" onClick={() => openSlot(0)}>
            Crop & Add…
          </Button>
          <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
            Upload…
            <input
              ref={slotInputRefs.current[0]}
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleSlotChange(0, e)}
            />
          </Button>
          <span className="bg-blue-200 text-white px-2 py-1 rounded">Slot 1</span>
          <Button variant="blue" disabled={!stagedFiles[0]} onClick={() => handleSlotSave(0)}>
            Save
          </Button>
          <Button variant="red" disabled={!extraImages[0]} onClick={() => handleDelete(0)}>
            Remove
          </Button>
        </ControlBar>
      </div>

      {/* Bulk upload bar */}
      <ControlBar className="mb-4 bg-gray-200">
        <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
          Browse…
          <input
            type="file"
            multiple
            accept="image/*"
            ref={bulkInputRef}
            onChange={handleBulkChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </Button>
        <div className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate">
          {bulkFiles.length ? bulkFiles.map((f) => f.name).join(', ') : 'No files chosen'}
        </div>
        <Button variant="blue" disabled={!bulkFiles.length} onClick={handleBulkUpload}>
          Save
        </Button>
      </ControlBar>
      {bulkError && <p className="text-red-600 text-sm mb-4">{bulkError}</p>}

      {/* Extra slots grid */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slotNum) => (
          <div
            key={slotNum}
            className={`border rounded-lg p-4 flex flex-col items-center ${
              activeSlot === slotNum ? 'bg-blue-200' : 'bg-white'
            }`}
          >
            <div
              onClick={() => openSlot(slotNum)}
              className="w-full h-48 bg-gray-200 rounded mb-2 overflow-hidden cursor-pointer flex items-center justify-center"
            >
              <img
                src={
                  localExtra[slotNum - 1]
                    ? localExtra[slotNum - 1].startsWith('http')
                      ? localExtra[slotNum - 1]
                      : `${BACKEND_BASE_URL}${normalizePath(localExtra[slotNum - 1])}`
                    : PLACEHOLDER_IMAGE
                }
                alt={`Slot ${slotNum}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
              />
            </div>
            <ControlBar className="bg-gray-200">
              <Button variant="orange" onClick={() => openSlot(slotNum)}>
                Crop & Add…
              </Button>
              <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
                Upload…
                <input
                  ref={slotInputRefs.current[slotNum]}
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleSlotChange(slotNum, e)}
                />
              </Button>
              <span className="bg-blue-200 text-white px-2 py-1 rounded">Slot {slotNum}</span>
              <Button variant="blue" disabled={!stagedFiles[slotNum]} onClick={() => handleSlotSave(slotNum)}>
                Save
              </Button>
              <Button variant="red" disabled={!localExtra[slotNum - 1]} onClick={() => handleDelete(slotNum)}>
                Remove
              </Button>
            </ControlBar>
          </div>
        ))}
      </div>

      {/* Crop & Caption Modal */}
      {step > 1 && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <Cropper
              image={URL.createObjectURL(selectedFile)}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <textarea
              placeholder="Add a caption…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full border rounded mt-4 p-2 text-sm"
            />
            <div className="flex justify-between mt-4">
              <Button variant="gray" onClick={handleBack}>Back</Button>
              <Button variant="gray" onClick={handleNext}>Next</Button>
            </div>
            {step === 3 && (
              <Button variant="blue" className="mt-4 w-full" onClick={handleSubmitCrop}>
                Save Cropped
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

MultiStepPhotoUploader.propTypes = {
  userId:      PropTypes.string.isRequired,
  isPremium:   PropTypes.bool,
  extraImages: PropTypes.arrayOf(PropTypes.string),
  onSuccess:   PropTypes.func,
  onError:     PropTypes.func,
};
