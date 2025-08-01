/ src/components/social/InstagramFeed.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Client-side component: näyttää Instagram-feedin
 * @param {{ username: string, count?: number }} props
 */
export default function InstagramFeed({ username, count = 5 }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await axios.get(`/api/social/instagram/${username}?count=${count}`);
        setPosts(res.data);
      } catch (err) {
        console.error('Instagram feed fetch error', err);
      }
    }
    fetchFeed();
  }, [username, count]);

  return (
    <div className="instagram-feed">
      {posts.map(post => (
        <a key={post.id} href={post.link} target="_blank" rel="noopener noreferrer">
          <img src={post.thumbnail} alt={post.caption || 'Instagram post'} />
        </a>
      ))}
    </div>
  );
}