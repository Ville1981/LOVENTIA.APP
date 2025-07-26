// File: src/components/ErrorComponent.jsx
import React from 'react';

/**
 * Displays error messages and provides a retry mechanism.
 * @param {{ message: string, onRetry: () => void }} props
 */
export default function ErrorComponent({ message, onRetry }) {
  // --- REPLACE START: ErrorComponent with English text and markers
  return (
    <div className="flex flex-col justify-center items-center p-4">
      <p role="alert" className="text-red-600 mb-2">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring"
      >
        Retry
      </button>
    </div>
  );
  // --- REPLACE END: ErrorComponent implementation
}
