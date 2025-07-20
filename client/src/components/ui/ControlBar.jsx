import React from 'react';
import PropTypes from 'prop-types';

/**
 * ControlBar
 *
 * Groups controls into a flex layout with border, padding, rounded corners,
 * a default background, and spacing.
 *
 * Props:
 * - children: elements to render inside this control bar
 * - className: additional Tailwind CSS classes to customize styling
 *
 * Ensures a gray background if none is provided.
 */
export default function ControlBar({ children = null, className = '' }) {
  // Base classes for layout and styling
  const baseClasses = [
    'flex items-center space-x-2',
    'border border-gray-300 p-2 rounded-lg',
  ];

  // Check if user provided any background class (bg-*)
  const hasBg = className.split(/\s+/).some((c) => c.startsWith('bg-'));
  const bgClass = hasBg ? '' : 'bg-gray-100';

  // Combine all classes
  const classes = [...baseClasses, bgClass, className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

ControlBar.propTypes = {
  children:  PropTypes.node,
  className: PropTypes.string,
};
