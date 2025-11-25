// PATH: client/src/components/RequireAuth.jsx

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// --- REPLACE START: simple RequireAuth gate using AuthContext.user ---
export default function RequireAuth({ children }) {
  // AuthContext exposes `user`, not `authUser`
  const { user } = useAuth();
  const location = useLocation();

  // If not logged in, redirect to /login and remember where we came from
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // Logged in → allow protected children to render
  return children;
}
// --- REPLACE END: simple RequireAuth gate using AuthContext.user ---
