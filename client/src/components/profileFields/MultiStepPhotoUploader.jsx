// src/components/profileFields/MultiStepPhotoUploader.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { useTranslation } from 'react-i18next'
import {
  uploadPhotoStep,
  deletePhotoSlot,
  uploadPhotos,
} from '../../api/images'
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from '../../config'
import ControlBar from '../ui/ControlBar'
import Button from '../ui/Button'

export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const { t } = useTranslation()
  // Increase free-user slot count to 7; premium remains 20
  const maxSlots = isPremium ? 20 : 7

  // --- Cropper workflow state ---
  const [step, setStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [caption, setCaption] = useState('')
  const [slot, setSlot] = useState(0)

  // --- Bulk upload state ---
  const [bulkFiles, setBulkFiles] = useState([])
  const [bulkError, setBulkError] = useState('')

  // --- Grid images & staged files ---
  const [localImages, setLocalImages] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  )
  const [stagedFiles, setStagedFiles] = useState({})

  const fileInputRef = useRef(null)
  const bulkInputRef = useRef(null)

  // Sync incoming images into padded array
  useEffect(() => {
    const padded = Array.from(
      { length: maxSlots },
      (_, i) => extraImages[i] || null
    )
    setLocalImages(padded)
  }, [extraImages, maxSlots])

  // Scroll to top on entering crop step
  useEffect(() => {
    if (step > 1) window.scrollTo(0, 0)
  }, [step])

  // Find first empty slot or default to 0
  const findFirstEmpty = useCallback(() => {
    const idx = localImages.findIndex((img) => !img)
    return idx !== -1 ? idx : 0
  }, [localImages])

  // Open cropping flow for a given slot
  const openSlot = useCallback((idx) => {
    setSlot(idx)
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current.click()
  }, [])

  // Handle file selection for cropping
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setStep(2)
    }
  }, [])

  // Capture cropped area pixel coords
  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])
  const handleNext = useCallback(() => setStep((s) => Math.min(s + 1, 4)), [])
  const handleBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), [])

  // Submit cropped image to backend
  const handleSubmitCrop = async () => {
    if (!userId || !selectedFile || !croppedAreaPixels) return
    try {
      const form = new FormData()
      form.append('photo', selectedFile)
      form.append('slot', slot)
      form.append('cropX', croppedAreaPixels.x)
      form.append('cropY', croppedAreaPixels.y)
      form.append('cropWidth', croppedAreaPixels.width)
      form.append('cropHeight', croppedAreaPixels.height)
      if (caption) form.append('caption', caption)

      const { extraImages: images } = await uploadPhotoStep(userId, form)
      setLocalImages(images.map((img) => img || null).slice(0, maxSlots))
      onSuccess(images)

      // Reset cropper state
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

  // Direct per-slot save without manual crop
  const handleSlotFileChange = (idx, e) => {
    const file = e.target.files?.[0] || null
    setStagedFiles((prev) => ({ ...prev, [idx]: file }))
  }

  const handleSlotSave = (idx) => {
    const file = stagedFiles[idx]
    if (!userId || !file) return

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      try {
        const form = new FormData()
        form.append('photo', file)
        form.append('slot', idx)
        form.append('cropX', 0)
        form.append('cropY', 0)
        form.append('cropWidth', img.naturalWidth)
        form.append('cropHeight', img.naturalHeight)

        const { extraImages: images } = await uploadPhotoStep(userId, form)
        setLocalImages(images.map((img) => img || null).slice(0, maxSlots))
        onSuccess(images)

        // Clear staged file
        setStagedFiles((prev) => {
          const copy = { ...prev }
          delete copy[idx]
          return copy
        })
      } catch (err) {
        onError(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  // Delete photo in slot
  const handleDelete = async (idx) => {
    if (!userId) return
    try {
      const { extraImages: images } = await deletePhotoSlot(userId, idx)
      setLocalImages(images.map((img) => img || null).slice(0, maxSlots))
      onSuccess(images)
    } catch (err) {
      onError(err)
    }
  }

  // Bulk upload handlers
  const handleBulkChange = (e) => {
    setBulkError('')
    setBulkFiles(Array.from(e.target.files || []))
  }
  const handleBulkUpload = async () => {
    if (!userId || !bulkFiles.length) return
    try {
      const form = new FormData()
      bulkFiles.forEach((file) => form.append('photos', file))
      const { extraImages: images } = await uploadPhotos(userId, form)
      setLocalImages(images.map((img) => img || null).slice(0, maxSlots))
      onSuccess(images)
      setBulkFiles([])
      if (bulkInputRef.current) bulkInputRef.current.value = ''
    } catch (err) {
      setBulkError(err?.response?.data?.error || err.message)
      onError(err)
    }
  }

  // Calculate number of slots to display: filled slots + next empty, capped
  const filledCount = localImages.filter((img) => img).length
  const visibleSlotsCount = Math.min(filledCount + 1, maxSlots)

  return (
    <div>
      {/* Hidden input for cropping file picker */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Avatar slot */}
      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex flex-col items-center mb-4">
        {localImages[0] ? (
          <img
            src={
              localImages[0].startsWith('http')
                ? localImages[0]
                : `${BACKEND_BASE_URL}${localImages[0]}`
            }
            alt="Avatar"
            className="w-32 h-32 object-cover rounded-full border border-gray-200 mb-2"
            onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
          />
        ) : (
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
            No Image
          </div>
        )}

        <ControlBar className="bg-gray-100">
          <Button variant="green" onClick={() => openSlot(0)}>
            Add Photo
          </Button>
          <div className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-700 text-sm">
            Slot 1
          </div>
          <Button
            variant="purple"
            disabled={!stagedFiles[0]}
            onClick={() => handleSlotSave(0)}
          >
            Save
          </Button>
          <Button
            variant="red"
            disabled={!localImages[0]}
            onClick={() => handleDelete(0)}
          >
            Remove
          </Button>
        </ControlBar>
      </div>

      {/* Bulk upload */}
      <div className="mb-4">
        <ControlBar className="bg-gray-100">
          <Button as="label" variant="green" htmlFor="bulk-input">
            Add Photos…
            <input
              id="bulk-input"
              type="file"
              multiple
              accept="image/*"
              ref={bulkInputRef}
              onChange={handleBulkChange}
              className="hidden"
            />
          </Button>
          <div className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-700 text-sm truncate">
            {bulkFiles.length
              ? bulkFiles.map((f) => f.name).join(', ')
              : 'No files chosen'}
          </div>
          <Button
            variant="purple"
            disabled={!bulkFiles.length}
            onClick={handleBulkUpload}
          >
            Save
          </Button>
        </ControlBar>
        {bulkError && <p className="mt-2 text-red-600 text-sm">{bulkError}</p>}
      </div>

      {/* Remaining slots */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {localImages.slice(1, visibleSlotsCount).map((src, idx) => {
          const i = idx + 1
          return (
            <div
              key={i}
              className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex flex-col items-center"
            >
              <div
                className="w-full h-48 flex items-center justify-center bg-gray-100 hover:bg-gray-200 cursor-pointer rounded-md mb-2 overflow-hidden"
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
                    onError={(e) =>
                      (e.currentTarget.src = PLACEHOLDER_IMAGE)
                    }
                  />
                ) : (
                  <span className="text-gray-500 text-4xl">+</span>
                )}
              </div>

              <ControlBar className="bg-gray-100">
                <Button
                  variant="green"
                  onClick={() => openSlot(i)}
                >
                  Add Photo
                </Button>
                <div className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-700 text-sm truncate">
                  Slot {i + 1}
                </div>
                <Button
                  variant="purple"
                  disabled={!stagedFiles[i]}
                  onClick={() => handleSlotSave(i)}
                >
                  Save
                </Button>
                <Button
                  variant="red"
                  disabled={!localImages[i]}
                  onClick={() => handleDelete(i)}
                >
                  Remove
                </Button>
              </ControlBar>
            </div>
          )
        })}
      </div>

      {/* Cropping & caption modal */}
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
              <Button variant="gray" onClick={handleBack}>
                Back
              </Button>
              <Button variant="blue" onClick={handleNext}>
                Next
              </Button>
            </div>
            <Button
              className="mt-4 w-full"
              variant="green"
              onClick={handleSubmitCrop}
            >
              Save Cropped
            </Button>
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
