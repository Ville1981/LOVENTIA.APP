// PATH: client/src/App.jsx

// --- REPLACE START: use AuthContext.user instead of authUser field ---
import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import ErrorBoundary from "./components/ErrorBoundary";
import { ForgotPassword } from "./components/ForgotPassword";
// ✅ this is the version we just fixed: client/src/components/ResetPassword.jsx
import ResetPassword from "./components/ResetPassword.jsx";
import MainLayout from "./components/MainLayout";
import ConsentBanner from "./components/privacy/ConsentBanner";
import { useAuth } from "./contexts/AuthContext";
import { trackPageView } from "./utils/analytics";

import Etusivu from "./pages/Etusivu";
import Discover from "./pages/Discover";
import About from "./pages/About";
import Support from "./pages/Support";
import Security from "./pages/Security";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";

import Login from "./pages/Login";
import Register from "./pages/Register";

import ProfileHub from "./pages/ProfileHub";
import ExtraPhotosPage from "./pages/ExtraPhotosPage";
import MatchPage from "./pages/MatchPage";
import MessagesOverview from "./pages/MessagesOverview";
import ChatPage from "./pages/ChatPage";
import MapPage from "./pages/MapPage";
import Upgrade from "./pages/Upgrade";
import WhoLikedMe from "./pages/WhoLikedMe";
import PremiumCancel from "./pages/PremiumCancel";
import LikesOverview from "./pages/LikesOverview";
import PremiumHub from "./pages/PremiumHub";

import AdminPanel from "./pages/AdminPanel";

import SettingsPage from "./pages/SettingsPage";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";
import NotFound from "./pages/NotFound";

// React Query client with calm defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Private route gate – uses user from AuthContext
function PrivateRoute({ children }) {
  // 🔑 AuthContext exposes `user`, so alias it locally to authUser
  const { user: authUser, bootstrapped } = useAuth();

  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  return authUser ? children : <Navigate to="/login" replace />;
}

// Admin-only route gate – also uses user from AuthContext
function AdminRoute({ children }) {
  const { user: authUser, bootstrapped } = useAuth();

  if (!bootstrapped) {
    return <div className="p-4">Loading...</div>;
  }

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  return authUser.role === "admin" ? children : <Navigate to="/" replace />;
}

// Route-level analytics: track page views on navigation.
// Respect consent via analytics.js gating (no direct provider calls here).
function RouteAnalytics() {
  const location = useLocation();

  useEffect(() => {
    try {
      trackPageView(location.pathname + location.search);
    } catch {
      // Swallow analytics errors to avoid breaking navigation
    }
  }, [location.pathname, location.search]);

  return null;
}

// MSW in dev only
if (
  typeof window !== "undefined" &&
  import.meta?.env?.MODE !== "test" &&
  !globalThis.__VITEST__ &&
  import.meta?.env?.VITE_MSW === "1"
) {
  (async () => {
    try {
      const mod = await import("./mocks/browser");
      if (mod?.worker?.start) {
        await mod.worker.start({ onUnhandledRequest: "bypass" });
      }
    } catch {
      // ignore if mocks missing
    }
  })();
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
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div className="p-4">Loading translations…</div>}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {/* Route-level analytics hook (consent-aware via analytics.js) */}
            <RouteAnalytics />

            {/* Global consent banner */}
            <ConsentBanner />

            <Routes>
              <Route path="/" element={<MainLayout />}>
                {/* Public routes */}
                <Route index element={<Etusivu />} />
                <Route path="discover" element={<Discover />} />
                <Route path="about" element={<About />} />
                <Route path="support" element={<Support />} />
                <Route path="security" element={<Security />} />
                <Route path="privacy" element={<PrivacyPolicy />} />
                <Route path="terms" element={<Terms />} />
                <Route path="cookies" element={<Cookies />} />

                {/* Auth-free */}
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />

                {/* Profile / protected */}
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

                {/* Matches / messages */}
                <Route
                  path="matches"
                  element={
                    <PrivateRoute>
                      <MatchPage />
                    </PrivateRoute>
                  }
                />
                {/* --- REPLACE START: wire /likes to LikesOverview and /who-liked-me to WhoLikedMe --- */}
                <Route
                  path="likes"
                  element={
                    <PrivateRoute>
                      <LikesOverview />
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
                {/* --- REPLACE END --- */}
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

                {/* Billing / upgrade / premium */}
                <Route
                  path="cancel"
                  element={
                    <PrivateRoute>
                      <PremiumCancel />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="upgrade"
                  element={
                    <PrivateRoute>
                      <Upgrade />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="premium"
                  element={
                    <PrivateRoute>
                      <PremiumHub />
                    </PrivateRoute>
                  }
                />

                {/* Map */}
                <Route
                  path="map"
                  element={
                    <PrivateRoute>
                      <MapPage />
                    </PrivateRoute>
                  }
                />

                {/* Settings */}
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
                      <SubscriptionSettings />
                    </PrivateRoute>
                  }
                />

                {/* Password helpers */}
                <Route path="forgot-password" element={<ForgotPassword />} />
                {/* ✅ This route uses the fixed component that sends { token, password, id? } */}
                <Route path="reset-password" element={<ResetPassword />} />

                {/* Admin-only */}
                <Route
                  path="admin"
                  element={
                    <AdminRoute>
                      <AdminPanel />
                    </AdminRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
// --- REPLACE END ---

