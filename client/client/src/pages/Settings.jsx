// src/pages/Settings.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axiosInstance';

export default function Settings() {
  const { logout } = useAuth();

  const handleDelete = async () => {
    if (!window.confirm('Oletko varma, että haluat poistaa tilisi pysyvästi?')) return;
    try {
      await api.delete('/auth/delete');
      logout();
    } catch (err) {
      console.error('Tilin poisto epäonnistui:', err);
      alert('Tilin poisto epäonnistui. Yritä hetken kuluttua uudelleen.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold">Account settings</h1>

      {/* Tässä voisi olla lomake profiilin muokkaukseen, salasanan vaihtoon jne. */}

      <section className="mt-8 border-t pt-6">
        <h2 className="text-xl font-semibold text-red-600">Danger zone</h2>
        <p className="text-sm text-gray-700 mb-4">
          Kun poistat tilisi, kaikki tietosi katoavat pysyvästi.
        </p>
        <button
          onClick={handleDelete}
          className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
        >
          Delete my account
        </button>
      </section>
    </div>
  );
}
