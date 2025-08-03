// src/ui/SlotControl.jsx
import React from 'react';
import PropTypes from 'prop-types';
import ControlBar from './ControlBar';
import Button from './Button';

/**
 * SlotControl
 *
 * Renders controls for managing a single photo slot:
 * - Crop & Add… / Upload… via passed handlers
 * - Slot number label
 * - Save & Remove buttons
 *
 * Props:
 * - index: slot index (0-based)
 * - isActive: whether this slot is currently active (for highlighting)
 * - onAdd: callback when Crop & Add is clicked
 * - onUpload: callback when Upload label is used
 * - onSave: callback when Save is clicked
 * - onRemove: callback when Remove is clicked
 * - disableSave: boolean to disable Save button
 * - disableRemove: boolean to disable Remove button
 */
export default function SlotControl({
  index,
  isActive = false,
  onAdd,
  onUpload,
  onSave,
  onRemove,
  disableSave = false,
  disableRemove = false,
}) {
  return (
    <ControlBar className={isActive ? 'bg-blue-200' : ''}>
      <Button variant="orange" onClick={() => onAdd(index)}>
        Crop & Add…
      </Button>

      <label className="relative inline-block overflow-hidden">
        <Button variant="gray">Upload…</Button>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => onUpload(index, e)}
        />
      </label>

      <span className="px-2 py-1 bg-blue-200 text-white rounded text-sm">
        Slot {index + 1}
      </span>

      <Button
        variant="blue"
        disabled={disableSave}
        onClick={() => onSave(index)}
      >
        Save
      </Button>

      <Button
        variant="red"
        disabled={disableRemove}
        onClick={() => onRemove(index)}
      >
        Remove
      </Button>
    </ControlBar>
  );
}

SlotControl.propTypes = {
  index:         PropTypes.number.isRequired,
  isActive:      PropTypes.bool,
  onAdd:         PropTypes.func.isRequired,
  onUpload:      PropTypes.func.isRequired,
  onSave:        PropTypes.func.isRequired,
  onRemove:      PropTypes.func.isRequired,
  disableSave:   PropTypes.bool,
  disableRemove: PropTypes.bool,
};
