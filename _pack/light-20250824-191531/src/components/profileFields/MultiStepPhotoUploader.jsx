// --- REPLACE START: keep full functionality, improve i18n, no unnecessary shortening ---
import PropTypes from "prop-types";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  uploadPhotoStep,
  deletePhotoSlot,
  uploadPhotos,
} from "../../api/images";
import { BACKEND_BASE_URL, PLACEHOLDER_IMAGE } from "../../config";
import Button from "../ui/Button";
import ControlBar from "../ui/ControlBar";

// Normalize Windows backslashes (\) → forward slash (/)
const normalizePath = (p = "") =>
  "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");

export default function MultiStepPhotoUploader({
  userId,
  isPremium = false,
  extraImages = [],
  onSuccess = () => {},
  onError = () => {},
}) {
  const { t } = useTranslation();
  const maxSlots = isPremium ? 50 : 9;

  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [localExtra, setLocalExtra] = useState(
    Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
  );
  const [stagedFiles, setStagedFiles] = useState({});

  const slotInputRefs = useRef([]);
  const bulkInputRef = useRef(null);

  if (slotInputRefs.current.length !== maxSlots) {
    slotInputRefs.current = Array(maxSlots)
      .fill()
      .map((_, i) => slotInputRefs.current[i] || React.createRef());
  }

  useEffect(() => {
    setLocalExtra(
      Array.from({ length: maxSlots }, (_, i) => extraImages[i] || null)
    );
  }, [extraImages, maxSlots]);

  const handleSlotChange = (idx, e) => {
    const file = e.target.files?.[0] || null;
    setStagedFiles((prev) => ({ ...prev, [idx]: file }));
  };

  const handleSlotSave = async (idx) => {
    const file = stagedFiles[idx];
    if (!file) return;
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("slot", idx);
      // no hardcoded crop params

      const { extraImages: updated } = await uploadPhotoStep(userId, form);
      setLocalExtra(updated.map((i) => i || null));
      onSuccess(updated);
      setStagedFiles((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    } catch (err) {
      onError(err);
    }
  };

  const handleDelete = async (idx) => {
    try {
      const { extraImages: updated } = await deletePhotoSlot(userId, idx);
      setLocalExtra(updated.map((i) => i || null));
      onSuccess(updated);
    } catch (err) {
      onError(err);
    }
  };

  const handleBulkChange = (e) => {
    setBulkFiles(Array.from(e.target.files || []));
    setBulkError("");
  };

  const handleBulkUpload = async () => {
    if (!bulkFiles.length) return;
    try {
      const form = new FormData();
      bulkFiles.forEach((f) => form.append("photos", f));
      const { extraImages: updated } = await uploadPhotos(userId, form);
      setLocalExtra(updated.map((i) => i || null));
      onSuccess(updated);
      setBulkFiles([]);
      bulkInputRef.current.value = "";
    } catch (err) {
      setBulkError(err.response?.data?.error || err.message);
      onError(err);
    }
  };

  return (
    <div>
      {/* Avatar slot */}
      <div className="border rounded-lg p-4 bg-gray-100 mb-4 flex flex-col items-center">
        <img
          src={
            extraImages[0]
              ? extraImages[0].startsWith("http")
                ? extraImages[0]
                : `${BACKEND_BASE_URL}${normalizePath(extraImages[0])}`
              : PLACEHOLDER_IMAGE
          }
          alt="Avatar"
          className="w-32 h-32 rounded-full object-cover mb-2"
          onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
        />
        <input
          ref={slotInputRefs.current[0]}
          type="file"
          accept="image/*"
          onChange={(e) => handleSlotChange(0, e)}
          className="hidden"
        />
        <ControlBar>
          <Button
            variant="gray"
            type="button"
            className="min-w-[120px]"
            onClick={() => slotInputRefs.current[0].current.click()}
          >
            {t("Browse…")}
          </Button>
          <div className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate">
            {stagedFiles[0]?.name || t("No files chosen")}
          </div>
          <Button
            variant="blue"
            type="button"
            disabled={!stagedFiles[0]}
            onClick={() => handleSlotSave(0)}
          >
            {t("Save")}
          </Button>
          <Button
            variant="red"
            type="button"
            disabled={!localExtra[0]}
            onClick={() => handleDelete(0)}
          >
            {t("Remove")}
          </Button>
        </ControlBar>
      </div>

      {/* Bulk upload */}
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleBulkChange}
        className="hidden"
      />
      <ControlBar className="mb-4 bg-gray-200">
        <Button
          variant="gray"
          type="button"
          className="min-w-[120px]"
          onClick={() => bulkInputRef.current.click()}
        >
          {t("Browse…")}
        </Button>
        <div className="flex-1 border bg-white px-3 py-2 rounded text-gray-700 text-sm truncate">
          {bulkFiles.length
            ? bulkFiles.map((f) => f.name).join(", ")
            : t("No files chosen")}
        </div>
        <Button
          variant="blue"
          type="button"
          disabled={!bulkFiles.length}
          onClick={handleBulkUpload}
        >
          {t("Save")}
        </Button>
      </ControlBar>
      {bulkError && <p className="text-red-600 text-sm mb-4">{bulkError}</p>}

      {/* Extra slots */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: maxSlots }).map((_, idx) => {
          const slotNum = idx + 1;
          return (
            <div
              key={slotNum}
              className="border rounded-lg p-4 flex flex-col items-center bg-white"
            >
              <div className="w-full h-48 bg-gray-200 rounded mb-2 overflow-hidden flex items-center justify-center">
                <img
                  src={
                    localExtra[idx]
                      ? localExtra[idx].startsWith("http")
                        ? localExtra[idx]
                        : `${BACKEND_BASE_URL}${normalizePath(localExtra[idx])}`
                      : PLACEHOLDER_IMAGE
                  }
                  alt={`Slot ${slotNum}`}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
                />
              </div>
              <input
                ref={slotInputRefs.current[idx]}
                type="file"
                accept="image/*"
                onChange={(e) => handleSlotChange(idx, e)}
                className="hidden"
              />
              <ControlBar>
                <Button
                  variant="gray"
                  type="button"
                  className="min-w-[120px]"
                  onClick={() => slotInputRefs.current[idx].current.click()}
                >
                  {t("Browse…")}
                </Button>
                <span className="bg-blue-200 text-white px-2 py-1 rounded text-sm">
                  {t("Slot")} {slotNum}
                </span>
                <Button
                  variant="blue"
                  type="button"
                  disabled={!stagedFiles[idx]}
                  onClick={() => handleSlotSave(idx)}
                >
                  {t("Save")}
                </Button>
                <Button
                  variant="red"
                  type="button"
                  disabled={!localExtra[idx]}
                  onClick={() => handleDelete(idx)}
                >
                  {t("Remove")}
                </Button>
              </ControlBar>
            </div>
          );
        })}
      </div>
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
// --- REPLACE END ---













