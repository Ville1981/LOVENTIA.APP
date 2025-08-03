import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../utils/axiosInstance";

const MatchPage = () => {
  const { t } = useTranslation();
  const [matches, setMatches] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  const fetchMatches = async () => {
    try {
      // Haetaan oma profiili
      const meRes = await api.get("/auth/me");
      const me = meRes.data;
      setCurrentUser(me);

      // Haetaan matchit
      const matchRes = await api.get("/auth/matches");
      const data = matchRes.data;

      // Suodatetaan estot
      const filtered = data.filter(
        (u) => !me.blockedUsers?.includes(u._id) && !u.blockedUsers?.includes(me._id)
      );

      setMatches(filtered);
    } catch (err) {
      console.error("Failed to fetch matches", err);
      if (err.response?.status === 401) navigate("/login");
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [navigate]);

  const calculateMatchScore = (user) => {
    if (!currentUser) return 0;
    let score = 0;

    if (
      currentUser.preferredGender === "any" ||
      user.gender?.toLowerCase() === currentUser.preferredGender?.toLowerCase()
    ) score += 20;

    if (
      user.age &&
      user.age >= (currentUser.preferredMinAge || 18) &&
      user.age <= (currentUser.preferredMaxAge || 100)
    ) score += 20;

    const commonInterests = currentUser.preferredInterests?.filter((interest) =>
      user.interests?.includes(interest)
    );
    score += Math.min((commonInterests?.length || 0) * 10, 60);

    return score;
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-6 text-center">💘 {t("matches.title")}</h2>

      {matches.length === 0 ? (
        <p className="text-center text-gray-600">{t("matches.noMatches")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {matches.map((user) => {
            const matchScore = calculateMatchScore(user);
            return (
              <div key={user._id} className="bg-white p-4 rounded shadow-md text-center">
                <img
                  src={
                    user.profilePicture
                      ? `http://localhost:5000/${user.profilePicture}`
                      : "/default.jpg"
                  }
                  alt={user.name}
                  className="w-full h-48 object-cover rounded mb-3"
                />
                <h3 className="text-lg font-bold">{user.name}</h3>
                <p className="text-sm text-gray-600">
                  {user.age} {t("profile.age")} – {user.gender}
                </p>
                <p className="text-sm italic text-gray-500">{user.goal}</p>

                <p className="text-sm mt-2 text-green-600 font-medium">
                  💯 {t("matches.score")}: {matchScore}%
                </p>

                <Link
                  to={`/chat/${user._id}`}
                  className="text-blue-500 underline mt-2 inline-block"
                >
                  💬 {t("matches.openChat")}
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
