// client/src/components/SocialFeed.jsx
import React, { useEffect, useState } from 'react';
import { fetchInstagramPosts, fetchSpotifyPlaylist } from '../utils/api/social.js';

export function SocialFeed({ instagramUserId, spotifyPlaylistId }) {
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [spotifyData, setSpotifyData] = useState(null);

  useEffect(() => {
    async function loadSocialFeeds() {
      try {
        // --- REPLACE START: load Instagram & Spotify data ---
        const instaRes = await fetchInstagramPosts(instagramUserId);
        setInstagramPosts(instaRes.data);

        const spotifyRes = await fetchSpotifyPlaylist(spotifyPlaylistId);
        setSpotifyData(spotifyRes.data);
        // --- REPLACE END ---
      } catch (error) {
        console.error('Error loading social feeds:', error);
      }
    }
    loadSocialFeeds();
  }, [instagramUserId, spotifyPlaylistId]);

  return (
    <div className="social-feed">
      <section className="instagram-feed">
        <h3>Instagram Feed</h3>
        <ul>
          {instagramPosts.map((post) => (
            <li key={post.id}>
              <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                <img src={post.media_url} alt={post.caption || 'Instagram post'} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {spotifyData && (
        <section className="spotify-playlist">
          <h3>{spotifyData.name}</h3>
          <iframe
            src={spotifyData.embedUrl}
            width="300"
            height="380"
            frameBorder="0"
            allow="encrypted-media"
            title="Spotify Playlist"
          ></iframe>
        </section>
      )}
    </div>
  );
}
