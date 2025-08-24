// src/components/EmptyState.jsx

import React from "react";

/**
 * EmptyState: displays a message and optional icon when list is empty
 * Props:
 *  - message: string
 *  - icon: optional string key
 */
export default function EmptyState({ message, icon }) {
  const icons = {
    chat: (
      <svg
        className="w-12 h-12 mb-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 5.523-4.477 10-10 10S1 17.523 1 12 5.477 2 11 2s10 4.477 10 10z"
        />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center p-8 text-gray-500">
      {icon && icons[icon]}
      <p className="mt-2 text-lg text-center">{message}</p>
    </div>
  );
}
