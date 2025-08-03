// File: src/components/LoaderComponent.jsx
import React from "react";

/**
 * Universal loading indicator component for various views
 */
export default function LoaderComponent() {
  // --- REPLACE START: LoaderComponent implementation
  return (
    <div role="status" className="flex justify-center items-center p-4">
      <span className="sr-only">Loading...</span>
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
  // --- REPLACE END: LoaderComponent implementation
}
