// client/src/pages/ExtraPhotosPage.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ExtraPhotosFields from "../components/profileFields/ExtraPhotosFields";

const ExtraPhotosPage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate('/login');
      return;
    }
    axios
      .get("http://localhost:5000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setUser(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Käyttäjätietojen haku epäonnistui", err);
        setError("Käyttäjätietojen haku epäonnistui");
        setLoading(false);
      });
  }, [navigate]);

  const handleSuccess = (updatedUser) => {
    setUser(updatedUser);
    alert("Lisäkuvat päivitetty onnistuneesti!");
  };

  const handleError = (err) => {
    console.error("Lisäkuvien tallennus epäonnistui", err);
    alert("Lisäkuvien tallennus epäonnistui");
  };

  if (loading) return <div>Ladataan profiilia...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Lisäkuvat</h2>
      <ExtraPhotosFields
        user={user}
        token={localStorage.getItem("token")}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
};

export default ExtraPhotosPage;
