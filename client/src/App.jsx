import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Slick‐karusellin tyylit
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Sivut
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

// Uudet sivut
import PrivacyPolicy from "./pages/PrivacyPolicy";
import WhoLikedMe from "./pages/WhoLikedMe";
import MapPage from "./pages/MapPage";  // suora import ilman aliasia

const AppContent = () => (
  <Routes>
    {/* Kaikki nämä näyttävät nav‐baarin + outletin MainLayoutista */}
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Etusivu />} />
      <Route path="discover" element={<Discover />} />

      {/* Profiili */}
      <Route path="profile" element={<ProfileHub />} />
      <Route path="profile/:userId" element={<ProfileHub />} />

      <Route path="matches" element={<MatchPage />} />
      <Route path="cancel" element={<PremiumCancel />} />
      <Route path="chat/:userId" element={<ChatPage />} />
      <Route path="admin" element={<AdminPanel />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />

      {/* Premium‐upgrade */}
      <Route path="upgrade" element={<Upgrade />} />

      {/* Uudet sivut */}
      <Route path="privacy" element={<PrivacyPolicy />} />
      <Route path="who-liked-me" element={<WhoLikedMe />} />
      <Route path="map" element={<MapPage />} />
    </Route>

    {/* 404, jos mikään ei matchaa */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  useEffect(() => {
    // Estetään scroll‐restoration-bugit
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
