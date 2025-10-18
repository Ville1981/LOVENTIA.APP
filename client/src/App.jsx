// PATH: client/src/App.jsx

// --- REPLACE START: dedupe router imports and keep a single default export (fix Vitest transform errors) ---
import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import ErrorBoundary from "./components/ErrorBoundary";
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";
import MainLayout from "./components/MainLayout";
// --- REPLACE START: fix alias import → relative path for ConsentBanner ---
import ConsentBanner from "./components/privacy/ConsentBanner";
// --- REPLACE END ---
import { useAuth } from "./contexts/AuthContext";

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

import AdminPanel from "./pages/AdminPanel";

import SettingsPage from "./pages/SettingsPage";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";

import NotFound from "./pages/NotFound";
// --- REPLACE END ---

// React Query client with calm defaults (prevents noisy refetches during tests)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

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

// Start MSW only in dev when explicitly enabled, never during Vitest
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
      // Silently skip MSW if mocks are not present
    }
  })();
}

// --- REPLACE START: single canonical default export of App() ---
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
            {/* Consent is shown globally on all pages */}
            <ConsentBanner />

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

                {/* Auth-free */}
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />

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

                {/* Settings (protected) */}
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
