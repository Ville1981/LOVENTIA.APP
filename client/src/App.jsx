// client/src/App.jsx

import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Slick-karusellin CSS-tiedostot lisätään globaalisti, jotta karuselli toimii oikein
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import Etusivu from "./pages/Etusivu";
import Discover from "./pages/Discover";
import ProfileHub from "./pages/ProfileHub";
import MatchPage from "./pages/MatchPage";
import PremiumCancel from "./pages/PremiumCancel";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import MainLayout from "./components/MainLayout";
import Upgrade from "./pages/Upgrade";

// ✅ Uudet sivut
import PrivacyPolicy from "./pages/PrivacyPolicy";
import WhoLikedMe from "./pages/WhoLikedMe";
import MapView from "./pages/MapPage"; // huom: MapView sisällä
const MapPage = MapView; // korjattu exportnimi

const AppContent = () => {
  return (
    <Routes>
      {/* Sivut MainLayoutin sisällä (navbar + main content) */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Etusivu />} />
        <Route path="discover" element={<Discover />} />

        {/* Oma profiili */}
        <Route path="profile" element={<ProfileHub />} />
        {/* Toisen käyttäjän profiili */}
        <Route path="profile/:userId" element={<ProfileHub />} />

        <Route path="matches" element={<MatchPage />} />
        <Route path="cancel" element={<PremiumCancel />} />
        <Route path="chat/:userId" element={<ChatPage />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Premium-upgrade -sivu */}
        <Route path="upgrade" element={<Upgrade />} />

        {/* ✅ Uudet lisätyt reitit */}
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="who-liked-me" element={<WhoLikedMe />} />
        <Route path="map" element={<MapPage />} />
      </Route>

      {/* 404-sivu, jos mikään reitti ei täsmää */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "auto";
    }
    document.documentElement.style.overflowAnchor = "none";
  }, []);

  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
