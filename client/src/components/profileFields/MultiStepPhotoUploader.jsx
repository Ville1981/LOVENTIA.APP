import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useTranslation } from 'react-i18next';
import {
  uploadPhotoStep,
  deletePhotoSlot,
  uploadPhotos,
} from '../../api/images';
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config';
import ControlBar from '../ui/ControlBar';
import Button from '../ui/Button';

// Normalize Windows backslashes and ensure leading slash
const normalizePath = (p = '') => '/' + p.replace(/\\/g, '/').replace(/^\/+/, '');

export default function MultiStepPhotoUploader({
  userId,
  maxSlots = 7,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const { t } = useTranslation();

  // Cropper workflow state
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState('');
  const [slot, setSlot] = useState(0);

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkError, setBulkError] = useState('');

  // Local images & staged files
  const [localImages, setLocalImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );
  const [stagedFiles, setStagedFiles] = useState({});

  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  // Sync prop changes
  useEffect(() => {
    setLocalImages(
      Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
    );
  }, [extraImages, maxSlots]);

  // Helpers
  const findFirstEmpty = useCallback(() => {
    const idx = localImages.findIndex((img) => !img);
    return idx !== -1 ? idx : 0;
  }, [localImages]);

  const openSlot = useCallback((idx) => {
    setSlot(idx);
    fileInputRef.current && (fileInputRef.current.value = '', fileInputRef.current.click());
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    file && setSelectedFile(file) && setStep(2);
  }, []);

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  // Submit cropped image
  const handleSubmitCrop = async () => {
    if (!userId || !selectedFile || !croppedAreaPixels) return;
    try {
      const form = new FormData();
      form.append('photo', selectedFile);
      form.append('slot', slot);
      form.append('cropX', croppedAreaPixels.x);
      form.append('cropY', croppedAreaPixels.y);
      form.append('cropWidth', croppedAreaPixels.width);
      form.append('cropHeight', croppedAreaPixels.height);
      caption && form.append('caption', caption);

      const { extraImages: images } = await uploadPhotoStep(userId, form);
      setLocalImages(images.map((i) => i || null));
      onSuccess(images);

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

  // Direct upload
  const handleSlotFileChange = (idx, e) => {
    const file = e.target.files?.[0] || null;
    setStagedFiles((prev) => ({ ...prev, [idx]: file }));
  };

  const handleSlotSave = async (idx) => {
    const file = stagedFiles[idx];
    if (!userId || !file) return;
    const imgEl = new Image();
    imgEl.src = URL.createObjectURL(file);
    imgEl.onload = async () => {
      try {
        const form = new FormData();
        form.append('photo', file);
        form.append('slot', idx);
        form.append('cropX', 0);
        form.append('cropY', 0);
        form.append('cropWidth', imgEl.naturalWidth);
        form.append('cropHeight', imgEl.naturalHeight);

        const { extraImages: images } = await uploadPhotoStep(userId, form);
        setLocalImages(images.map((i) => i || null));
        onSuccess(images);
        setStagedFiles((prev) => { const c = { ...prev }; delete c[idx]; return c; });
      } catch (err) {
        onError(err);
      } finally {
        URL.revokeObjectURL(imgEl.src);
      }
    };
  };

  // Delete slot
  const handleDelete = async (idx) => {
    if (!userId) return;
    try {
      const { extraImages: images } = await deletePhotoSlot(userId, idx);
      setLocalImages(images.map((i) => i || null));
      onSuccess(images);
    } catch (err) {
      onError(err);
    }
  };

  // Bulk
  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
    setBulkError('');
  };

  const handleBulkUpload = async () => {
    if (!userId || !bulkFiles.length) return;
    try {
      const form = new FormData();
      bulkFiles.forEach((file) => form.append('photos', file));
      const { extraImages: images } = await uploadPhotos(userId, form);
      setLocalImages(images.map((i) => i || null));
      onSuccess(images);
      setBulkFiles([]);
    } catch (err) {
      setBulkError(err.message || 'Upload failed');
      onError(err);
    }
  };

  return (
    <div>
      {/* hidden crop input */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{position:'absolute',width:0,height:0,opacity:0}} />

      {/* avatar */}
      <div className="border rounded-lg p-4 bg-gray-100 mb-4 flex flex-col items-center">
        {localImages[0] ? (
          <img
            src={localImages[0].startsWith('http') ? localImages[0] : `${BACKEND_BASE_URL}${normalizePath(localImages[0])}`}
            alt="Avatar"
            className="w-32 h-32 rounded-full object-cover mb-2"
            onError={(e)=>(e.currentTarget.src=PLACEHOLDER_IMAGE)}
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 mb-2">No Image</div>
        )}
        <ControlBar className="bg-gray-100">
          <Button variant="orange" onClick={()=>openSlot(0)}>Crop & Add…</Button>
          <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
            Upload…<input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e=>handleSlotFileChange(0,e)} />
          </Button>
          <span className="bg-blue-200 text-white px-2 py-1 rounded">Slot 1</span>
          <Button variant="blue" disabled={!stagedFiles[0]} onClick={()=>handleSlotSave(0)}>Save</Button>
          <Button variant="red" disabled={!localImages[0]} onClick={()=>handleDelete(0)}>Remove</Button>
        </ControlBar>
      </div>

      {/* bulk upload */}
      <ControlBar className="bg-gray-100 mb-4">
        <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
          Browse…<input type="file" multiple accept="image/*" ref={bulkInputRef} onChange={handleBulkChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </Button>
        <div className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate">{bulkFiles.length?bulkFiles.map(f=>f.name).join(', '):'No files chosen'}</div>
        <Button variant="blue" disabled={!bulkFiles.length} onClick={handleBulkUpload}>Save</Button>
      </ControlBar>
      {bulkError && <p className="text-red-600 text-sm mb-4">{bulkError}</p>}

      {/* extra slots grid */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: maxSlots },(_,i)=>i).map(i=>
          <div key={i} className="border rounded-lg p-4 bg-gray-100 flex flex-col items-center">
            <div onClick={()=>openSlot(i)} className="w-full h-48 bg-gray-200 rounded mb-2 overflow-hidden cursor-pointer flex items-center justify-center">
              {localImages[i]?
                <img src={localImages[i].startsWith('http')?localImages[i]:`${BACKEND_BASE_URL}${normalizePath(localImages[i])}`} alt={`Slot ${i+1}`} className="w-full h-full object-cover" onError={e=>e.currentTarget.src=PLACEHOLDER_IMAGE}/>
              : <span className="text-gray-500 text-4xl">+</span>}
            </div>
            <ControlBar className="bg-gray-100">
              <Button variant="orange" onClick={()=>openSlot(i)}>Crop & Add…</Button>
              <Button variant="gray" as="label" className="relative inline-block overflow-hidden">
                Upload…<input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e=>handleSlotFileChange(i,e)}/>
              </Button>
              <span className="bg-blue-200 text-white px-2 py-1 rounded">Slot {i+1}</span>
              <Button variant="blue" disabled={!stagedFiles[i]} onClick={()=>handleSlotSave(i)}>Save</Button>
              <Button variant="red" disabled={!localImages[i]} onClick={()=>handleDelete(i)}>Remove</Button>
            </ControlBar>
          </div>
        )}
      </div>

      {/* cropping modal */}
      {step>1&&selectedFile&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <Cropper image={URL.createObjectURL(selectedFile)} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}/>
            <textarea placeholder="Add a caption…" value={caption} onChange={e=>setCaption(e.target.value)} className="w-full border rounded mt-4 p-2 text-sm"/>
            <div className="flex justify-between mt-4">
              <Button variant="gray" onClick={handleBack}>Back</Button>
              <Button variant="gray" onClick={handleNext}>Next</Button>
            </div>
            {step===3&&<Button variant="blue" className="mt-4 w-full" onClick={handleSubmitCrop}>Save Cropped</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

MultiStepPhotoUploader.propTypes={
  userId:PropTypes.string.isRequired,
  maxSlots:PropTypes.number,
  extraImages:PropTypes.arrayOf(PropTypes.string),
  onSuccess:PropTypes.func,
  onError:PropTypes.func,
};
