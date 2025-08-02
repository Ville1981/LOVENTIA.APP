// src/components/ErrorState.jsx

import React from 'react';

/**
 * ErrorState: displays an error message and a retry button
 * Props:
 *  - message: string
 *  - onRetry: function
 */
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center p-8 text-red-600">
      <svg
        className="w-12 h-12 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z"
        />
      </svg>
      <p className="mb-4 text-lg text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          {/* --- REPLACE START: English label for retry */}
          Retry
          {/* --- REPLACE END */}
        </button>
      )}
    </div>
  );
}
