// File: client/src/components/ProtectedRoute.jsx
// --- REPLACE START: ensure no blank render; use { user, bootstrapped } and navigate when unauthenticated ---
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Guards routes that require authentication.
 * - While bootstrapped === false, render a small loading placeholder (avoid blank return).
 * - When bootstrapped === true and user is null/undefined, navigate to the login route and
 *   preserve the original target in location.state.from.
 * - Otherwise render children (or <Outlet/> for nested routes).
 */
const ProtectedRoute = ({ children }) => {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  // Initial auth check still in progress — avoid empty render flash
  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  // Auth resolved and user missing — redirect to login and remember where we came from
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Authenticated: support both wrapped children and nested <Outlet/>
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
// --- REPLACE END ---
