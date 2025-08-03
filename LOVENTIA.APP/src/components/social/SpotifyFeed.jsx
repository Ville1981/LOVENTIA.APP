// src/components/social/SpotifyFeed.jsx

import axios from "axios";
import React, { useState, useEffect } from "react";

/**
 * Client-side component: näyttää Spotify-soittolistan
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
        setTracks(res.data);
      } catch (err) {
        console.error("Spotify feed fetch error", err);
      }
    }
    fetchTracks();
  }, [playlistId, count]);

  return (
    <div className="spotify-feed">
      {tracks.map((track) => (
        <div key={track.id} className="track">
          <img src={track.albumArt} alt={track.name} />
          <p>
            {track.name} — {track.artist}
          </p>
        </div>
      ))}
    </div>
  );
}
