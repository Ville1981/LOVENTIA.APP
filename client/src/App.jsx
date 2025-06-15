// client/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
import Upgrade from "./pages/Upgrade"; // 🌟 Uusi sivu

const AppContent = () => {
  return (
    <Routes>
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

        {/* Premium-upgrade */}
        <Route path="upgrade" element={<Upgrade />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
