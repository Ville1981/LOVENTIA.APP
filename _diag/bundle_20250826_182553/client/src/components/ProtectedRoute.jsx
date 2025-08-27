// --- REPLACE START: use AuthContext (user + bootstrapped) and preserve redirect target ---
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  // While the initial auth check is running, avoid flicker/incorrect redirect
  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  // If not authenticated, send to /login and remember where we came from
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Support both <ProtectedRoute><Page/></ProtectedRoute> and nested routes via <Outlet/>
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
// --- REPLACE END ---
