import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/MainLayout';
// --- REPLACE START: add ConversationsOverview import
import ConversationsOverview from './components/ConversationsOverview';
// --- REPLACE END: added ConversationsOverview import
import { AuthProvider, useAuth } from './context/AuthContext';

// Slick-carousel styles
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Forgot/reset password components
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';

// Pages
import Etusivu from './pages/Etusivu';
import Discover from './pages/Discover';
import ProfileHub from './pages/ProfileHub';
import ExtraPhotosPage from './pages/ExtraPhotosPage';
import MatchPage from './pages/MatchPage';
// import MessagesList    from "./pages/MessagesList"; // no longer used
import ChatPage from './pages/ChatPage';
import PremiumCancel from './pages/PremiumCancel';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Register from './pages/Register';
import Upgrade from './pages/Upgrade';
import PrivacyPolicy from './pages/PrivacyPolicy';
import WhoLikedMe from './pages/WhoLikedMe';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// PrivateRoute wrapper
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // disable anchor snapping
    document.documentElement.style.overflowAnchor = 'none';
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<div className="p-4">Loading translations…</div>}>
          <Router>
            <Routes>
              {/* All routes are wrapped in MainLayout */}
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
                {/* messaging overview */}
                // --- REPLACE START: use ConversationsOverview instead of MessagesList
                <Route
                  path="messages"
                  element={
                    <PrivateRoute>
                      <ConversationsOverview />
                    </PrivateRoute>
                  }
                />
                // --- REPLACE END: messaging overview
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
                <Route
                  path="settings"
                  element={
                    <PrivateRoute>
                      <Settings />
                    </PrivateRoute>
                  }
                />
                {/* password reset */}
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                {/* catch-all */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Router>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
