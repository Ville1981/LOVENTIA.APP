// client/src/components/ProtectedRoute.jsx

// --- REPLACE START: use AuthContext instead of direct localStorage check ---
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { authUser, bootstrapped } = useAuth();

  // While auth state is still being determined
  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
// --- REPLACE END ---
