// --- REPLACE START: import grouping and PrivateRoute/AdminRoute using context user+bootstrapped ---
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

// Subscriptions page (for /settings/subscriptions)
import Subscriptions from "./pages/Subscriptions";

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
import Settings from "./pages/Settings"; // legacy, kept for compatibility
import Upgrade from "./pages/Upgrade";
import WhoLikedMe from "./pages/WhoLikedMe";
import SettingsPage from "./pages/SettingsPage"; // the actual /settings page

// Footer pages (public)
import About from "./pages/About";
import Support from "./pages/Support";
import Security from "./pages/Security";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";

// Private route gate
function PrivateRoute({ children }) {
  const { user, bootstrapped } = useAuth();
  if (!bootstrapped) return <div className="p-4">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

// Admin-only route gate
function AdminRoute({ children }) {
  const { user, bootstrapped } = useAuth();
  if (!bootstrapped) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? children : <Navigate to="/" replace />;
}
// --- REPLACE END ---

export default function App() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    document.documentElement.style.overflowAnchor = "none";
  }, []);

  return (
    <ErrorBoundary>
      {/* --- REPLACE START: assume AuthProvider wraps the app in main.jsx; no nested provider here --- */}
      <Suspense fallback={<div className="p-4">Loading translations…</div>}>
        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              {/* Public routes */}
              <Route index element={<Etusivu />} />
              <Route path="discover" element={<Discover />} />

              {/* Public footer routes */}
              <Route path="about" element={<About />} />
              <Route path="support" element={<Support />} />
              <Route path="security" element={<Security />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="cookies" element={<Cookies />} />

              {/* Auth-protected */}
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

              {/* Admin-only */}
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                }
              />

              {/* Auth-free */}
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />

              {/* More protected routes */}
              <Route
                path="upgrade"
                element={
                  <PrivateRoute>
                    <Upgrade />
                  </PrivateRoute>
                }
              />
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

              {/* Settings (protected) - standalone siblings */}
              <Route
                path="settings"
                element={
                  <PrivateRoute>
                    <SettingsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="settings/subscriptions"
                element={
                  <PrivateRoute>
                    <Subscriptions />
                  </PrivateRoute>
                }
              />

              {/* Password helpers */}
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </Suspense>
      {/* --- REPLACE END --- */}
    </ErrorBoundary>
  );
}
