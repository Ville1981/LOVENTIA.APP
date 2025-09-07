// client/src/components/ui/Button.jsx
// --- REPLACE START: robust button that forwards onClick/type/disabled safely (keeps variants & propTypes) ---
import classNames from "classnames";
import PropTypes from "prop-types";
import React from "react";

/**
 * Button
 *
 * A styled button supporting variant and disabled states.
 * Wraps native <button> or accepts an "as" prop for custom elements (e.g., label).
 * IMPORTANT: default type="button" so it doesn't submit forms accidentally.
 *
 * Accessibility notes:
 * - If you render an icon-only button, pass an explicit `ariaLabel` string.
 * - For non-native elements (via `as`), we add role="button", keyboard handlers, and aria-disabled.
 */
export default function Button({
  children,
  variant = "gray",
  disabled = false,
  as: Component = "button",
  type = "button",
  className = "",
  onClick,
  ariaLabel, // optional, recommended for icon-only usage
  title, // optional tooltip/title text, must be a string
  ...rest
}) {
  // Base classes for padding, rounding, text color, shadow, hover & disabled states, focus outline, and transitions
  const baseClasses =
    "px-4 py-2 rounded-2xl shadow focus:outline-none transition";

  // Color variants; includes "orange" and "yellow" to cover existing calls
  const variantClasses = {
    green: "bg-green-600 text-white hover:bg-green-700",
    purple: "bg-purple-600 text-white hover:bg-purple-700",
    red: "bg-red-600 text-white hover:bg-red-700",
    gray: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    blue: "bg-blue-500 text-white hover:bg-blue-600",
    orange: "bg-orange-500 text-white hover:bg-orange-600",
    yellow: "bg-yellow-500 text-white hover:bg-yellow-600", // supported: <Button variant="yellow" />
  };

  const composed = classNames(
    baseClasses,
    variantClasses[variant] || variantClasses.gray,
    { "opacity-50 cursor-not-allowed": disabled, "cursor-pointer": !disabled },
    className
  );

  // Normalize attributes that must be strings for safety (prevents accidental object children in attributes)
  const normalizedAriaLabel =
    ariaLabel != null ? String(ariaLabel) : undefined;
  const normalizedTitle = title != null ? String(title) : undefined;

  // Wrap onClick to ignore clicks when disabled
  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (typeof onClick === "function") onClick(e);
  };

  // Common props shared by both native and custom elements
  const commonProps = {
    className: composed,
    disabled, // OK on native; harmless on custom elements; we also set aria-disabled where needed
    onClick: handleClick,
    "aria-label": normalizedAriaLabel,
    title: normalizedTitle,
    ...rest,
  };

  if (Component === "button") {
    return (
      <button type={type} {...commonProps}>
        {children}
      </button>
    );
  }

  // Keyboard accessibility for non-native interactive elements
  const onKeyDown = (e) => {
    if (disabled) return;
    // Activate on Enter or Space
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (typeof onClick === "function") onClick(e);
    }
  };

  // ARIA role & semantics for non-native interactive elements
  return (
    <Component
      role="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      {...commonProps}
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
    "yellow",
  ]),
  disabled: PropTypes.bool,
  as: PropTypes.elementType,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  className: PropTypes.string,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // coerced to string
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // coerced to string
};
// --- REPLACE END ---
