// src/components/Spinner.jsx

import React from 'react';

/**
 * Spinner: simple loading indicator using Tailwind CSS
 */
export default function Spinner() {
  return (
    <div className="flex justify-center items-center py-4">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-500" />
    </div>
  );
}
