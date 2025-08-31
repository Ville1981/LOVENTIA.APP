// File: client/src/components/Header.jsx

// --- REPLACE START: import NotificationsBell into header ---
import React from "react";
import { Link } from "react-router-dom";
import NotificationsBell from "./NotificationsBell";
// --- REPLACE END ---

function Header(props) {
  // Keep any prop usage intact (title, onLogout, rightActions etc.)
  const { title = "Loventia", onLogout, rightActions } = props || {};

  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: logo / nav */}
        <div className="flex items-center space-x-3">
          {/* Replace with your real logo if you have one */}
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/logo192.png"
              alt="Logo"
              className="h-8 w-8 rounded"
              loading="lazy"
            />
            <span className="text-lg font-semibold">{title}</span>
          </Link>
          {/* Add your top-level navigation here if needed */}
        </div>

        {/* Right: actions */}
        <div className="flex items-center space-x-2">
          {/* --- REPLACE START: place the bell among right-side actions --- */}
          <NotificationsBell />
          {/* --- REPLACE END --- */}

          {/* Preserve any externally provided right-side actions */}
          {rightActions}

          {/* Example: logout button (kept optional / non-breaking) */}
          {typeof onLogout === "function" && (
            <button
              type="button"
              onClick={onLogout}
              className="ml-2 px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
