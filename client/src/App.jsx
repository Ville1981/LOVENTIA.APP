// PATH: client/src/App.jsx
// File: client/src/App.jsx

// --- REPLACE START: route-level code splitting (keep homepage fast; reduce initial JS bundle) ---
import React, { Suspense, useEffect, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
// --- REPLACE END ---

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import ErrorBoundary from "./components/ErrorBoundary";
// --- REPLACE START: lazy-load password helpers to reduce initial bundle ---
// Previous:
// import { ForgotPassword } from "./components/ForgotPassword";
// import ResetPassword from "./components/ResetPassword.jsx";
// Now: lazy-load both; keep compatibility with named export in ForgotPassword.jsx.
// --- REPLACE END ---
import MainLayout from "./components/MainLayout";
import ConsentBanner from "./components/privacy/ConsentBanner";
import { useAuth } from "./contexts/AuthContext";
import { trackPageView } from "./utils/analytics";

// Keep homepage eager for best LCP (hero image loads immediately)
import Etusivu from "./pages/Etusivu";

// Lazy-load other routes to reduce initial bundle size (improves FCP/LCP on anon homepage)
const Discover = lazy(() => import("./pages/Discover"));
const About = lazy(() => import("./pages/About"));
const Support = lazy(() => import("./pages/Support"));
const Security = lazy(() => import("./pages/Security"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const ProfileHub = lazy(() => import("./pages/ProfileHub"));
const ExtraPhotosPage = lazy(() => import("./pages/ExtraPhotosPage"));
const MatchPage = lazy(() => import("./pages/MatchPage"));
const MessagesOverview = lazy(() => import("./pages/MessagesOverview"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const WhoLikedMe = lazy(() => import("./pages/WhoLikedMe"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess"));
const PremiumCancel = lazy(() => import("./pages/PremiumCancel"));
const LikesOverview = lazy(() => import("./pages/LikesOverview"));
const PremiumHub = lazy(() => import("./pages/PremiumHub"));

const AdminPanel = lazy(() => import("./pages/AdminPanel"));

const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SubscriptionSettings = lazy(() =>
  import("./pages/settings/SubscriptionSettings")
);
const NotFound = lazy(() => import("./pages/NotFound"));

// New page for email verification flow
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

// --- REPLACE START: lazy-load password helpers (named export + default export) ---
const ForgotPassword = lazy(() =>
  import("./components/ForgotPassword").then((mod) => ({
    default: mod.ForgotPassword,
  }))
);
const ResetPassword = lazy(() => import("./components/ResetPassword.jsx"));
// --- REPLACE END ---

// --- REPLACE START: CLS-safe shared loading placeholder (reserve stable space) ---
function StableLoading({ label = "Loading..." }) {
  // Reserve vertical space to reduce layout shifts while lazy routes/auth bootstrap.
  // Use inline style (no Tailwind config dependency).
  return (
    <div
      className="p-4"
      style={{ minHeight: "60vh" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {label}
    </div>
  );
}
// --- REPLACE END ---

// Private route gate – uses user from AuthContext
function PrivateRoute({ children }) {
  // NOTE: AuthContext exposes `user`, so alias it locally to authUser
  const { user: authUser, bootstrapped } = useAuth();

  // --- REPLACE START: CLS-safe loading placeholder ---
  if (!bootstrapped) {
    return <StableLoading label="Loading..." />;
  }
  // --- REPLACE END ---

  return authUser ? children : <Navigate to="/login" replace />;
}

// Admin-only route gate – also uses user from AuthContext
function AdminRoute({ children }) {
  const { user: authUser, bootstrapped } = useAuth();

  // --- REPLACE START: CLS-safe loading placeholder ---
  if (!bootstrapped) {
    return <StableLoading label="Loading..." />;
  }
  // --- REPLACE END ---

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

// --- REPLACE START: preserve query string when redirecting alias routes ---
function RedirectWithSearch({ to }) {
  const location = useLocation();
  const search = location?.search || "";
  return <Navigate to={`${to}${search}`} replace />;
}
// --- REPLACE END ---

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
      {/* --- REPLACE START: remove duplicate React Query provider (single source of truth in main.jsx) --- */}
      {/* React Query provider is mounted in client/src/main.jsx to avoid double clients and extra init work. */}
      {/* --- REPLACE END --- */}
      {/* --- REPLACE START: Suspense fallback (avoid mojibake ellipsis) --- */}
      <Suspense fallback={<StableLoading label="Loading translations..." />}>
        {/* --- REPLACE END --- */}
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

              {/* --- REPLACE START: add /help and /faq aliases (preserve query string) --- */}
              <Route path="help" element={<RedirectWithSearch to="/support" />} />
              <Route path="faq" element={<RedirectWithSearch to="/support" />} />
              {/* --- REPLACE END --- */}

              <Route path="security" element={<Security />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="cookies" element={<Cookies />} />

              {/* Auth-free */}
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />

              {/* Password helpers */}
              <Route path="forgot-password" element={<ForgotPassword />} />
              {/* OK: This route uses the fixed component that sends { token, password, id? } */}
              <Route path="reset-password" element={<ResetPassword />} />

              {/* OK: NEW: Email verification landing route.
                  This does NOT require login - link comes directly from email. */}
              <Route path="verify-email" element={<VerifyEmailPage />} />

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
              {/* --- REPLACE START: support Stripe return URLs (/premium/success and /premium/cancel) + keep aliases --- */}
              {/* Canonical Stripe return routes (do NOT require login; Stripe may return in a fresh browser session). */}
              <Route path="premium/success" element={<PremiumSuccess />} />
              <Route path="premium/cancel" element={<PremiumCancel />} />

              {/* Aliases kept for backwards compatibility (preserve query string). */}
              <Route
                path="premium-success"
                element={<RedirectWithSearch to="/premium/success" />}
              />
              <Route
                path="premium-cancel"
                element={<RedirectWithSearch to="/premium/cancel" />}
              />

              {/* Legacy/alias cancel route (kept for backwards compatibility). */}
              <Route
                path="cancel"
                element={<RedirectWithSearch to="/premium/cancel" />}
              />
              {/* --- REPLACE END --- */}

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
      {/* --- REPLACE START: remove duplicate React Query provider (single source of truth in main.jsx) --- */}
      {/* --- REPLACE END --- */}
    </ErrorBoundary>
  );
}










