import React from 'react';
import PropTypes from 'prop-types';
import ControlBar from './ControlBar';
import Button from './Button';

/**
 * SlotControl
 *
 * Renders controls for managing a single photo slot:
 * - Add Photo button
 * - Slot number label
 * - Remove button
 *
 * Props:
 * - index: slot index (0-based)
 * - onAdd: callback when Add Photo is clicked
 * - onRemove: callback when Remove is clicked
 * - disableRemove: boolean to disable the Remove button
 */
export default function SlotControl({
  index,
  onAdd,
  onRemove,
  disableRemove = false,
}) {
  return (
    <ControlBar className="bg-gray-50">
      <Button
        variant="orange"
        onClick={() => onAdd(index)}
        className="px-3 py-1"
      >
        Add Photo
      </Button>

      <div className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
        Slot {index + 1}
      </div>

      <Button
        variant="red"
        onClick={() => onRemove(index)}
        disabled={disableRemove}
        className="px-3 py-1"
      >
        Remove
      </Button>
    </ControlBar>
  );
}

SlotControl.propTypes = {
  index:         PropTypes.number.isRequired,
  onAdd:         PropTypes.func.isRequired,
  onRemove:      PropTypes.func.isRequired,
  disableRemove: PropTypes.bool,
};
