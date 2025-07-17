// src/App.jsx

import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";

// Slick‐karusellin tyylit
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

<<<<<<< HEAD
// Komponentit salasanan unohtamis- ja nollauslomakkeille
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";

=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
// Sivut
import Etusivu from "./pages/Etusivu";
import Discover from "./pages/Discover";
import ProfileHub from "./pages/ProfileHub";
import ExtraPhotosPage from "./pages/ExtraPhotosPage";
import MatchPage from "./pages/MatchPage";
import PremiumCancel from "./pages/PremiumCancel";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import MainLayout from "./components/MainLayout";
import Upgrade from "./pages/Upgrade";

// Uudet sivut
import PrivacyPolicy from "./pages/PrivacyPolicy";
import WhoLikedMe from "./pages/WhoLikedMe";
import MapPage from "./pages/MapPage";
import Settings from "./pages/Settings";

const AppContent = () => (
  <Routes>
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Etusivu />} />
      <Route path="discover" element={<Discover />} />

      {/* Profiilisivu ja profiilitiedot */}
      <Route path="profile" element={<ProfileHub />} />
      <Route path="profile/:userId" element={<ProfileHub />} />

      {/* Erotettu kuvasivu */}
      <Route path="profile/photos" element={<ExtraPhotosPage />} />

      <Route path="matches" element={<MatchPage />} />
      <Route path="cancel" element={<PremiumCancel />} />
      <Route path="chat/:userId" element={<ChatPage />} />
      <Route path="admin" element={<AdminPanel />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="upgrade" element={<Upgrade />} />
      <Route path="privacy" element={<PrivacyPolicy />} />
      <Route path="who-liked-me" element={<WhoLikedMe />} />
      <Route path="map" element={<MapPage />} />
      <Route path="settings" element={<Settings />} />
<<<<<<< HEAD

      {/* Salasanan nollausreitit */}
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
    </Route>

=======
    </Route>
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  useEffect(() => {
    // Estetään scroll‐restoration-bugit
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    document.documentElement.style.overflowAnchor = "none";
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
