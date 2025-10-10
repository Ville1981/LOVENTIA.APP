// PATH: client/src/App.jsx

// --- REPLACE START: add React Query defaults + fix import order + keep behavior intact ---
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";


import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import ErrorBoundary from "./components/ErrorBoundary";
import { ForgotPassword } from "./components/ForgotPassword";
import MainLayout from "./components/MainLayout";
import { ResetPassword } from "./components/ResetPassword";
import { useAuth } from "./contexts/AuthContext";
import About from "./pages/About";
import AdminPanel from "./pages/AdminPanel";
import ChatPage from "./pages/ChatPage";
import Cookies from "./pages/Cookies";
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
import Security from "./pages/Security";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";
import SettingsPage from "./pages/SettingsPage";
import Support from "./pages/Support";
import Terms from "./pages/Terms";
import Upgrade from "./pages/Upgrade";
import WhoLikedMe from "./pages/WhoLikedMe";
// --- REPLACE START: mount ConsentBanner (add near root layout) ---
import ConsentBanner from "@/components/privacy/ConsentBanner";

// File: client/src/App.jsx  (tai client/src/router.jsx tms.)

// --- REPLACE START: add routes for Privacy & Cookies (react-router v6) ---
import { Routes, Route } from "react-router-dom";
import Privacy from "./pages/Privacy.jsx";
import Cookies from "./pages/Cookies.jsx";

// ...inside your component's return:
<Routes>
  {/* ...your existing routes... */}
  <Route path="/privacy" element={<Privacy />} />
  <Route path="/cookies" element={<Cookies />} />
</Routes>
// --- REPLACE END ---

// ...
function App() {
  return (
    <>
      {/* ...your providers/layouts... */}
      <ConsentBanner />
    </>
  );
}

// File: client/src/App.jsx (example route addition)

// --- REPLACE START: add admin dashboard route (example) ---
// import AdminDashboard from "./pages/admin/AdminDashboard";
// <Route path="/admin/kpi" element={<AdminDashboard />} />
// --- REPLACE END ---

// --- REPLACE END ---

// --- REPLACE START: add route for Referral page (example) ---
// import Referral from "./pages/Referral";
// <Route path="/referral" element={<Referral />} />
// --- REPLACE END ---


// React Query client with calmer defaults to avoid refetch bursts while selects are open
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

// Only attempt to start MSW in dev when explicitly enabled, never during Vitest.
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
      // Silently skip MSW if mocks are not present in this build
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
