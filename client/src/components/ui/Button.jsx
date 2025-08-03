import classNames from "classnames";
import PropTypes from "prop-types";
import React from "react";

/**
 * Button
 *
 * A styled button supporting variant and disabled states.
 * Wraps native <button> or accepts an "as" prop for custom elements (e.g., label).
 */
export default function Button({
  children,
  variant = "gray",
  disabled = false,
  as: Component = "button",
  className = "",
  ...rest
}) {
  // Base classes for padding, rounding, text color, shadow, hover & disabled states, focus outline, and transitions
  const baseClasses =
    "px-4 py-2 rounded-2xl shadow focus:outline-none transition";

  // Color variants; orange added for Crop & Add
  const variantClasses = {
    green: "bg-green-600 text-white hover:bg-green-700",
    purple: "bg-purple-600 text-white hover:bg-purple-700",
    red: "bg-red-600 text-white hover:bg-red-700",
    gray: "bg-gray-100 text-gray-800 hover:bg-gray-200", // ← dark text on gray
    blue: "bg-blue-500 text-white hover:bg-blue-600",
    orange: "bg-orange-500 text-white hover:bg-orange-600",
  };

  return (
    <Component
      className={classNames(
        baseClasses,
        variantClasses[variant] || variantClasses.gray,
        { "opacity-50 cursor-not-allowed": disabled },
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
  variant: PropTypes.oneOf([
    "green",
    "purple",
    "red",
    "gray",
    "blue",
    "orange",
  ]),
  disabled: PropTypes.bool,
  as: PropTypes.elementType,
  className: PropTypes.string,
};
