// File: src/App.jsx

// --- REPLACE START: import grouping and PrivateRoute declaration ---
// 1. React & Core
import React, { useEffect, Suspense } from "react";

// 2. React Router
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// 3. Styles
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// 4. Context & Utilities
import ErrorBoundary from "./components/ErrorBoundary";

// 5. Components/Layout
import { ForgotPassword } from "./components/ForgotPassword";
import MainLayout from "./components/MainLayout";

// 6. Utility Components
import { ResetPassword } from "./components/ResetPassword";
import { AuthProvider, useAuth } from "./context/AuthContext";

// 7. Pages (Alphabetical)
import AdminPanel from "./pages/AdminPanel";
import ChatPage from "./pages/ChatPage";
import Discover from "./pages/Discover";
import Etusivu from "./pages/Etusivu";
import ExtraPhotosPage from "./pages/ExtraPhotosPage";
import Login from "./pages/Login";
import MapPage from "./pages/MapPage";
import MatchPage from "./pages/MatchPage";
import MessagesOverview from "./pages/MessagesOverview";
import NotFound from "./pages/NotFound";
import PremiumCancel from "./pages/PremiumCancel";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ProfileHub from "./pages/ProfileHub";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";
import WhoLikedMe from "./pages/WhoLikedMe";
// --- REPLACE END ---

// PrivateRoute component for authenticated routes
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    document.documentElement.style.overflowAnchor = "none";
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<div className="p-4">Loading translations…</div>}>
          <Router>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Etusivu />} />
                <Route path="discover" element={<Discover />} />
                <Route path="profile" element={<PrivateRoute><ProfileHub /></PrivateRoute>} />
                <Route path="profile/:userId" element={<PrivateRoute><ProfileHub /></PrivateRoute>} />
                <Route path="profile/photos" element={<PrivateRoute><ExtraPhotosPage /></PrivateRoute>} />
                <Route path="matches" element={<PrivateRoute><MatchPage /></PrivateRoute>} />
                <Route path="messages" element={<PrivateRoute><MessagesOverview /></PrivateRoute>} />
                <Route path="chat/:userId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
                <Route path="cancel" element={<PrivateRoute><PremiumCancel /></PrivateRoute>} />
                <Route path="admin" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="upgrade" element={<PrivateRoute><Upgrade /></PrivateRoute>} />
                <Route path="privacy" element={<PrivacyPolicy />} />
                <Route path="who-liked-me" element={<PrivateRoute><WhoLikedMe /></PrivateRoute>} />
                <Route path="map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
                <Route path="settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Router>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
