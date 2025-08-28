// File: client/src/pages/Intros.jsx
// --- REPLACE START: new page for introsMessaging feature ---
import React, { useEffect, useState } from "react";
import api from "../services/api/axiosInstance"; // axios wrapper
import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../contexts/AuthContext";

/**
 * Premium-only Intros page.
 * Allows starting or viewing intro messages.
 */
export default function Intros() {
  const { user } = useAuth();
  const [intros, setIntros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchIntros = async () => {
      setLoading(true);
      try {
        const res = await api.get("/intros"); // backend route
        if (Array.isArray(res?.data)) {
          setIntros(res.data);
        } else {
          setIntros([]);
        }
      } catch (err) {
        console.error("Failed to load intros:", err?.response?.data || err);
        setError("Could not load intros.");
      } finally {
        setLoading(false);
      }
    };

    fetchIntros();
  }, []);

  const handleStartIntro = async () => {
    try {
      const res = await api.post("/intros/start", { targetUserId: "demoUserId" });
      console.log("Intro started:", res.data);
      alert("Intro started successfully (stub).");
    } catch (err) {
      console.error("Failed to start intro:", err?.response?.data || err);
      alert("Failed to start intro.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">✉️ Intros</h1>

      <FeatureGate
        user={user}
        feature="introsMessaging"
        fallback={
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
            <p className="mb-2">
              This feature is available for <strong>Premium</strong> members.
            </p>
            <a
              href="/settings/subscriptions"
              className="inline-block px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
            >
              Upgrade to Premium
            </a>
          </div>
        }
      >
        {/* Premium-only content */}
        {loading && <p>Loading intros...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && intros.length === 0 && (
          <p className="text-gray-600">No intros yet. Start one!</p>
        )}

        <div className="space-y-4">
          {intros.map((intro) => (
            <div key={intro._id} className="p-3 border rounded bg-white shadow">
              <p>
                <strong>{intro.fromUser?.username || "Someone"}</strong> →{" "}
                {intro.message || "(no message)"}
              </p>
            </div>
          ))}
        </div>

        {/* Action: start intro */}
        <button
          onClick={handleStartIntro}
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ➕ Start Intro
        </button>
      </FeatureGate>
    </div>
  );
}
// --- REPLACE END ---
