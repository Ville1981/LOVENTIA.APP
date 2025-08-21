// src/components/ErrorBoundary.jsx

import PropTypes from "prop-types";
import React from "react";

/**
 * ErrorBoundary
 * Catches JS errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Usage:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Lifecycle method: catch errors in children.
   * @param {Error} error
   * @param {Object} errorInfo
   */
  componentDidCatch(error, errorInfo) {
    // --- REPLACE START: update state, log externally but remove console.error to satisfy lint
    this.setState({ hasError: true, error, errorInfo });
    // You can also log error to an external service here:
    // logErrorService.log(error, errorInfo);
    // --- REPLACE END ---
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>We’re having trouble loading this part of the application.</p>
          {/* Optionally show error details in development */}
          {(
            // --- REPLACE START: guard process.env to avoid undefined in browser
            typeof process !== "undefined" &&
            process.env.NODE_ENV === "development"
            // --- REPLACE END ---
          ) && (
            <details style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </details>
          )}
        </div>
      );
    }

    // Render children if no error
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  // --- REPLACE START: add PropTypes for children ---
  children: PropTypes.node.isRequired,
  // --- REPLACE END ---
};
