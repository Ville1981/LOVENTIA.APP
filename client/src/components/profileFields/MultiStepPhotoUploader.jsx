// src/components/profileFields/MultiStepPhotoUploader.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { uploadPhotoStep, deletePhotoSlot, uploadPhotos } from '../../api/images'
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config'

export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const maxSlots = isPremium ? 20 : 6

  const [step, setStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [bulkFiles, setBulkFiles] = useState([])
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [caption, setCaption] = useState('')
  const [slot, setSlot] = useState(0)
  const [localImages, setLocalImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  )

  const fileInputRef = useRef(null)
  const bulkInputRef = useRef(null)

  // Synkronoi localImages aina, kun extraImages-prop muuttuu
  useEffect(() => {
    const padded = Array.from(
      { length: maxSlots },
      (_, i) => extraImages[i] || null
    )
    setLocalImages(padded)
    const firstEmpty = padded.findIndex((img) => !img)
    setSlot(firstEmpty !== -1 ? firstEmpty : 0)
  }, [extraImages, maxSlots])

  useEffect(() => {
    if (step > 1) window.scrollTo(0, 0)
  }, [step])

  const findFirstEmpty = useCallback(() => {
    const idx = localImages.findIndex((img) => !img)
    return idx !== -1 ? idx : 0
  }, [localImages])

  const openSlot = useCallback((idx) => {
    setSlot(idx)
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current.click()
  }, [])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setStep(2)
    }
  }, [])

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleNext = useCallback(() => setStep((s) => Math.min(s + 1, 4)), [])
  const handleBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), [])

  const handleSubmit = async () => {
    if (!userId || !selectedFile || !croppedAreaPixels) return
    try {
      const form = new FormData()
      form.append('photo', selectedFile)
      form.append('slot', slot.toString())
      form.append('cropX', croppedAreaPixels.x.toString())
      form.append('cropY', croppedAreaPixels.y.toString())
      form.append('cropWidth', croppedAreaPixels.width.toString())
      form.append('cropHeight', croppedAreaPixels.height.toString())
      if (caption) form.append('caption', caption)

      // Upload a single photo step
      const { extraImages: images } = await uploadPhotoStep(userId, form)
      const padded = Array.from(
        { length: maxSlots },
        (_, i) => images[i] || null
      )
      setLocalImages(padded)
      onSuccess(images)

      // Reset state
      setStep(1)
      setSelectedFile(null)
      setCaption('')
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setSlot(findFirstEmpty())
    } catch (err) {
      onError(err)
    }
  }

  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []))
  }

  const handleBulkUpload = async () => {
    if (!userId || !bulkFiles.length) return
    try {
      const form = new FormData()
      bulkFiles.forEach((file) => form.append('photos', file))
      const { extraImages: images } = await uploadPhotos(userId, form)
      const padded = Array.from(
        { length: maxSlots },
        (_, i) => images[i] || null
      )
      setLocalImages(padded)
      onSuccess(images)
      setBulkFiles([])
      if (bulkInputRef.current) bulkInputRef.current.value = ''
    } catch (err) {
      onError(err)
    }
  }

  const handleDelete = async (i) => {
    if (!userId) return
    try {
      const { extraImages: images } = await deletePhotoSlot(userId, i)
      const padded = Array.from(
        { length: maxSlots },
        (_, idx) => images[idx] || null
      )
      setLocalImages(padded)
      onSuccess(images)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <div>
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
          Save extra photos
        </button>
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-3 gap-4 mt-4">
        {localImages.map((src, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="border p-2 flex items-center justify-center w-full h-48 bg-gray-100 hover:bg-gray-200 cursor-pointer"
              onClick={() => openSlot(i)}
            >
              {src ? (
                <img
                  src={
                    src.startsWith('http')
                      ? src
                      : `${BACKEND_BASE_URL}${src}`
                  }
                  alt={`Slot ${i + 1}`}
                  className="object-cover w-full h-full"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE }}
                />
              ) : (
                <span className="text-gray-500 text-xl">+</span>
              )}
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

      {step > 1 && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            {/* ...crop UI sekä back/next/submit-napit */}
          </div>
        </div>
      )}
    </div>
  )
}

MultiStepPhotoUploader.propTypes = {
  userId: PropTypes.string.isRequired,
  isPremium: PropTypes.bool,
  extraImages: PropTypes.arrayOf(PropTypes.string),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
}
