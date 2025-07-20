import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

/**
 * Button
 *
 * A styled button supporting variant and disabled states.
 * Wraps native <button> or accepts an "as" prop for custom elements (e.g., label).
 */
export default function Button({
  children,
  variant = 'gray',
  disabled = false,
  as: Component = 'button',
  className = '',
  ...rest
}) {
  // Base classes for padding, rounding, text color, disabled/hover states, focus outline, and transitions
  const baseClasses =
    'px-3 py-1 rounded text-white hover:opacity-90 disabled:opacity-50 focus:outline-none transition';

  // Color variants; orange added for Crop & Add
  const variantClasses = {
    green:  'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    red:    'bg-red-600 hover:bg-red-700',
    gray:   'bg-gray-100 hover:bg-gray-200 text-black',
    blue:   'bg-blue-600 hover:bg-blue-700',
    orange: 'bg-orange-500 hover:bg-orange-600',
  };

  return (
    <Component
      className={classNames(
        baseClasses,
        variantClasses[variant],
        { 'cursor-not-allowed': disabled },
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </Component>
  );
}

Button.propTypes = {
  children:  PropTypes.node,
  variant:   PropTypes.oneOf(['green','purple','red','gray','blue','orange']),
  disabled:  PropTypes.bool,
  as:        PropTypes.elementType,
  className: PropTypes.string,
};
