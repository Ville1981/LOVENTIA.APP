// File: client/src/components/social/InstagramFeed.jsx

// --- REPLACE START: use centralized axios instance ---
import axios from "../../utils/axiosInstance";
// --- REPLACE END ---
import React, { useState, useEffect } from 'react';

// --- REPLACE START: JSDoc clarified in English
/**
 * InstagramFeed
 * Client-side component that displays an Instagram feed.
 * @param {Object} props
 * @param {string} props.username - Instagram username to fetch the feed for
 * @param {number} [props.count=5] - Number of posts to display
 */
// --- REPLACE END
export default function InstagramFeed({ username, count = 5 }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await axios.get(
          `/api/social/instagram/${username}?count=${count}`
        );
        setPosts(res.data);
      } catch (err) {
        console.error('Instagram feed fetch error', err);
      }
    }
    if (username) {
      fetchFeed();
    }
  }, [username, count]);

  return (
    <div className="instagram-feed">
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={post.thumbnail}
            alt={post.caption || 'Instagram post'}
          />
        </a>
      ))}
    </div>
  );
}
