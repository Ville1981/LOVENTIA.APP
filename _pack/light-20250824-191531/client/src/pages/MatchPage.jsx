// --- REPLACE START: resilient Matches page (English texts, fixed API + image URL) ---
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api/axiosInstance";
import { BACKEND_BASE_URL } from "../utils/config";

function photoUrl(user) {
  const raw =
    user?.profilePicture ||
    user?.photos?.[0]?.url ||
    user?.photos?.[0] ||
    "";
  if (!raw) return "/default.jpg";
  if (typeof raw !== "string") return "/default.jpg";
  if (raw.startsWith("http")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${BACKEND_BASE_URL}${path}`;
}

const MatchPage = () => {
  const { t } = useTranslation();
  const [matches, setMatches] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  const fetchMatches = async () => {
    try {
      // Load current user
      const meRes = await api.get("/auth/me");
      const me = meRes?.data?.user || meRes?.data || null;
      setCurrentUser(me);

      // Load matches
      const matchRes = await api.get("/auth/matches");
      const list =
        (Array.isArray(matchRes?.data?.matches) && matchRes.data.matches) ||
        matchRes?.data ||
        [];

      // Filter blocks (defensive)
      const blockedByMe = Array.isArray(me?.blockedUsers) ? me.blockedUsers : [];
      const filtered = list.filter((u) => {
        const uBlocked = Array.isArray(u?.blockedUsers) ? u.blockedUsers : [];
        const uid = u?._id || u?.id;
        return !blockedByMe.includes(uid) && !uBlocked.includes(me?._id);
      });

      setMatches(filtered);
    } catch (err) {
      console.error("Failed to fetch matches:", err?.response?.data || err);
      if (err?.response?.status === 401) navigate("/login");
    }
  };

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const calculateMatchScore = (user) => {
    if (!currentUser) return 0;
    let score = 0;

    if (
      currentUser.preferredGender === "any" ||
      (user?.gender &&
        user.gender.toLowerCase() === currentUser?.preferredGender?.toLowerCase())
    ) {
      score += 20;
    }

    if (
      user?.age &&
      user.age >= (currentUser?.preferredMinAge || 18) &&
      user.age <= (currentUser?.preferredMaxAge || 120)
    ) {
      score += 20;
    }

    const prefs = Array.isArray(currentUser?.preferredInterests)
      ? currentUser.preferredInterests
      : [];
    const uInterests = Array.isArray(user?.interests) ? user.interests : [];
    const commonInterests = prefs.filter((i) => uInterests.includes(i));
    score += Math.min((commonInterests.length || 0) * 10, 60);

    return score;
    };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-6 text-center">
        💘 {t("matches.title", "Matches")}
      </h2>

      {matches.length === 0 ? (
        <p className="text-center text-gray-600">
          {t("matches.noMatches", "No matches yet.")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {matches.map((user) => {
            const id = user?._id || user?.id;
            const img = photoUrl(user);
            const name = user?.name || user?.username || "Anonymous";
            const goal = user?.goal || user?.lookingFor || "";
            const matchScore = calculateMatchScore(user);

            return (
              <div key={id} className="bg-white p-4 rounded shadow-md text-center">
                <img
                  src={img}
                  alt={name}
                  className="w-full h-48 object-cover rounded mb-3"
                />
                <h3 className="text-lg font-bold">{name}</h3>
                <p className="text-sm text-gray-600">
                  {user?.age ? `${user.age} ${t("profile:age", "years")}` : ""}
                  {user?.gender ? ` – ${user.gender}` : ""}
                </p>
                {goal && (
                  <p className="text-sm italic text-gray-500">{goal}</p>
                )}

                <p className="text-sm mt-2 text-green-600 font-medium">
                  💯 {t("matches.score", "Match score")}: {matchScore}%
                </p>

                <Link
                  to={`/chat/${id}`}
                  className="text-blue-500 underline mt-2 inline-block"
                >
                  💬 {t("matches.openChat", "Open chat")}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchPage;
// --- REPLACE END ---
