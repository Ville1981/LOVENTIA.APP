// src/content/blog/AutoPublishScheduler.js  (Server-side)

import cron from 'node-cron';
import { BlogEngine } from './BlogEngine.js';

/**
 * Ajoittaa automaattisen julkaisun cron-ajastimella joka tunti
 */
export function initAutoPublish() {
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    // Hae postit joiden publishDate <= nyt ja merkitse ne julkisiksi
    const posts = await BlogEngine.getPublishedPosts();
    console.log(`Auto-publish check at ${now.toISOString()}, found ${posts.length} posts.`);
  });
}