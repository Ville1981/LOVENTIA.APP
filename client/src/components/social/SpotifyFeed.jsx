// File: client/src/components/social/SpotifyFeed.jsx

// --- REPLACE START: use centralized axios instance instead of raw axios ---
import axios from "../../utils/axiosInstance";
// --- REPLACE END ---
import React, { useState, useEffect } from "react";

/**
 * SpotifyFeed
 * Client-side component that displays a Spotify playlist feed.
 * @param {{ playlistId: string, count?: number }} props
 */
export default function SpotifyFeed({ playlistId, count = 5 }) {
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    async function fetchTracks() {
      try {
        const res = await axios.get(
          `/api/social/spotify/${playlistId}?count=${count}`
        );
        setTracks(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Spotify feed fetch error", err);
        setTracks([]);
      }
    }
    if (playlistId) {
      fetchTracks();
    }
  }, [playlistId, count]);

  return (
    <div className="spotify-feed">
      {tracks.map((track) => (
        <div key={track.id} className="track flex items-center gap-3 py-2">
          <img
            src={track.albumArt}
            alt={track.name}
            className="w-12 h-12 object-cover rounded"
          />
          <p className="text-sm">
            <span className="font-medium">{track.name}</span>
            {" — "}
            <span className="text-gray-600">{track.artist}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
