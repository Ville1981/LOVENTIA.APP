// src/ui/ControlBar.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * ControlBar
 *
 * Groups controls into a flex layout with border, padding, rounded corners,
 * a default gray-200 background (unless overridden via className), and spacing.
 *
 * Props:
 * - children: elements to render inside this control bar
 * - className: additional Tailwind CSS classes to customize styling
 */
export default function ControlBar({ children = null, className = '' }) {
  // Base classes for layout and styling
  const baseClasses = [
    'flex items-center space-x-2',
    'border border-gray-300 p-2 rounded-lg',
  ];

  // Detect if a bg-* class was provided in className
  const hasBg = className
    .split(/\s+/)
    .some((c) => c.startsWith('bg-'));

  // Only apply default bg-gray-200 if none was provided
  const bgClass = hasBg ? '' : 'bg-gray-200';

  // Merge all classes
  const classes = [...baseClasses, bgClass, className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

ControlBar.propTypes = {
  children:  PropTypes.node,
  className: PropTypes.string,
};
