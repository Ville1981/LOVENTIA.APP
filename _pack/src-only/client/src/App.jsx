// File: client/src/App.jsx

// --- REPLACE START: import grouping and PrivateRoute using context user+bootstrapped ---
import React, { useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Styles
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Context & Utilities
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";

// Components/Layout
import MainLayout from "./components/MainLayout";

// Utility Components
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";

// Pages (Alphabetical)
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
import Settings from "./pages/Settings";        // kept for backwards compatibility (not used by the route)
import Upgrade from "./pages/Upgrade";
import WhoLikedMe from "./pages/WhoLikedMe";
import SettingsPage from "./pages/SettingsPage"; // the actual /settings page we want

// PrivateRoute uses context user
function PrivateRoute({ children }) {
  const { user, bootstrapped } = useAuth();

  // Wait until initial auth check finishes; do not redirect yet
  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  // If authenticated, render; otherwise redirect to login
  return user ? children : <Navigate to="/login" replace />;
}
// --- REPLACE END ---

export default function App() {
  useEffect(() => {
    // Prevent automatic scroll restoration on navigation
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // Prevent Chrome scroll anchoring when DOM changes height
    document.documentElement.style.overflowAnchor = "none";
  }, []);

  return (
    <ErrorBoundary>
      {/* --- REPLACE START: assume AuthProvider wraps the app in main.jsx; no nested provider here --- */}
      <Suspense fallback={<div className="p-4">Loading translations…</div>}>
        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Etusivu />} />
              <Route path="discover" element={<Discover />} />

              <Route
                path="profile"
                element={
                  <PrivateRoute>
                    <ProfileHub />
                  </PrivateRoute>
                }
              />
              <Route
                path="profile/:userId"
                element={
                  <PrivateRoute>
                    <ProfileHub />
                  </PrivateRoute>
                }
              />
              <Route
                path="profile/photos"
                element={
                  <PrivateRoute>
                    <ExtraPhotosPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="matches"
                element={
                  <PrivateRoute>
                    <MatchPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="messages"
                element={
                  <PrivateRoute>
                    <MessagesOverview />
                  </PrivateRoute>
                }
              />
              <Route
                path="chat/:userId"
                element={
                  <PrivateRoute>
                    <ChatPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="cancel"
                element={
                  <PrivateRoute>
                    <PremiumCancel />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <PrivateRoute>
                    <AdminPanel />
                  </PrivateRoute>
                }
              />

              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />

              <Route
                path="upgrade"
                element={
                  <PrivateRoute>
                    <Upgrade />
                  </PrivateRoute>
                }
              />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route
                path="who-liked-me"
                element={
                  <PrivateRoute>
                    <WhoLikedMe />
                  </PrivateRoute>
                }
              />
              <Route
                path="map"
                element={
                  <PrivateRoute>
                    <MapPage />
                  </PrivateRoute>
                }
              />

              {/* --- REPLACE START: single source of truth for /settings route
                   Use SettingsPage (the one with hide/unhide UI) and protect it. --- */}
              <Route
                path="settings"
                element={
                  <PrivateRoute>
                    <SettingsPage />
                  </PrivateRoute>
                }
              />
              {/* --- REPLACE END --- */}

              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </Suspense>
      {/* --- REPLACE END --- */}
    </ErrorBoundary>
  );
}
