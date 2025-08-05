import React from "react";

/**
 * Etusivu
 * The home page is rendered by MainLayout.jsx, so this component
 * itself must render the actual homepage content.
 */
const Etusivu = () => {
  return (
    <div className="px-4 py-6">
      {/* --- REPLACE START: Add homepage content --- */}
      <h1 className="text-4xl font-bold mb-4">Welcome to Loventia.app</h1>
      <p className="text-lg">
        Discover new connections and meaningful conversations.
      </p>
      {/* --- REPLACE END --- */}
    </div>
  );
};

export default Etusivu;
