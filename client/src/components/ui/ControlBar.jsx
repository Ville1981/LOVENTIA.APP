// src/components/ui/ControlBar.jsx
import React from 'react'
import PropTypes from 'prop-types'

/**
 * ControlBar
 * 
 * A simple wrapper for grouping controls (buttons, labels, file inputs) into a
 * consistent flex layout with border, padding, rounded corners, background, and spacing.
 *
 * Usage:
 * <ControlBar>
 *   <button>Action</button>
 *   <label>…</label>
 * </ControlBar>
 */
export default function ControlBar({ children = null, className = '' }) {
  const baseClasses = [
    'flex items-center space-x-2',
    'border border-gray-300 p-2 rounded-lg',
    'bg-gray-100',            // default gray background for consistency
  ]

  return (
    <div
      className={[...baseClasses, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}

ControlBar.propTypes = {
  /** Child elements to render inside the bar */
  children: PropTypes.node,
  /** Additional Tailwind classes to merge onto the wrapper */
  className: PropTypes.string,
}

// Note: Default props are handled via function parameter defaults above.
