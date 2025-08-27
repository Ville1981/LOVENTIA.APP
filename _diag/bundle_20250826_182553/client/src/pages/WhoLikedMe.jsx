// --- REPLACE START: robust "Who liked me" page (English texts, fixed API + image URL) ---
import React, { useEffect, useState } from "react";
import api from "../services/api/axiosInstance";
import { BACKEND_BASE_URL } from "../utils/config";

function resolvePhotoUrl(user) {
  const raw =
    user?.profilePicture ||
    user?.photos?.[0]?.url ||
    user?.photos?.[0] ||
    "";

  if (!raw) return "/default.jpg";
  if (typeof raw !== "string") return "/default.jpg";
  if (raw.startsWith("http")) return raw;

  // Ensure single slash between base and path
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${BACKEND_BASE_URL}${path}`;
}

const WhoLikedMe = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWhoLikedMe = async () => {
      try {
        const res = await api.get("/auth/who-liked-me");
        const list = Array.isArray(res?.data?.users) ? res.data.users : res?.data || [];
        setUsers(list);
      } catch (err) {
        console.error("Error fetching likes:", err?.response?.data || err);
        if (err?.response?.status === 403) {
          setError("❌ This feature is available for Premium users only.");
        } else if (err?.response?.status === 401) {
          setError("Please sign in to view who liked you.");
        } else {
          setError("Failed to load likes.");
        }
      }
    };

    fetchWhoLikedMe();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4 text-center">
        👀 Who liked you
      </h2>

      {error && <p className="text-center text-red-500">{error}</p>}

      {!error && users.length === 0 && (
        <p className="text-center text-gray-600">No likes yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {users.map((u) => {
          const key = u?._id || u?.id;
          const img = resolvePhotoUrl(u);
          const title = u?.name || u?.username || "Anonymous";
          const email = u?.email || "";
          return (
            <div key={key} className="bg-white p-4 rounded shadow-md text-center">
              <img
                src={img}
                alt={title}
                className="w-full h-48 object-cover rounded mb-3"
              />
              <h3 className="text-lg font-bold">{title}</h3>
              {email && <p className="text-sm text-gray-600">{email}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WhoLikedMe;
// --- REPLACE END ---
