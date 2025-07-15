import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

/**
 * Button
 * 
 * A styled button supporting variant and disabled states.
 * Wraps native <button> or accepts "as" prop for custom elements (e.g., label).
 *
 * Props:
 * - variant: one of 'green', 'purple', 'red', 'gray', 'blue'
 * - disabled: boolean
 * - as: string or component (e.g. 'button', 'label')
 * - className: additional classes
 */
export default function Button({
  children,
  variant = 'gray',
  disabled = false,
  as: Component = 'button',
  className = '',
  ...rest
}) {
  const baseClasses = 'px-3 py-1 text-white rounded hover:opacity-90 disabled:opacity-50 focus:outline-none';
  const variantClasses = {
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    red: 'bg-red-600 hover:bg-red-700',
    gray: 'bg-gray-300 hover:bg-gray-400 text-black',
    blue: 'bg-blue-600 hover:bg-blue-700',
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
  children: PropTypes.node,
  variant: PropTypes.oneOf(['green', 'purple', 'red', 'gray', 'blue']),
  disabled: PropTypes.bool,
  as: PropTypes.elementType,
  className: PropTypes.string,
};

Button.defaultProps = {
  children: null,
  variant: 'gray',
  disabled: false,
  as: 'button',
  className: '',
};
