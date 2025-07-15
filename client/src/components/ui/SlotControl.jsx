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
 * The entire control bar is wrapped in a light gray border with rounded corners.
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
    <ControlBar className="border border-gray-300 rounded-lg p-2 bg-gray-50 space-x-2">
      <Button
        variant="green"
        onClick={() => onAdd(index)}
        className="px-3 py-1"
      >
        Add Photo
      </Button>

      <span className="px-2 text-sm text-gray-700">
        Slot {index + 1}
      </span>

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
  index: PropTypes.number.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  disableRemove: PropTypes.bool,
};

SlotControl.defaultProps = {
  disableRemove: false,
};
