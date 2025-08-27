// --- REPLACE START: convert ESM to CommonJS; keep logic intact and paths robust ---
'use strict';

const cron = require('node-cron');
const { BlogEngine } = require('./BlogEngine.js');

/**
 * Schedules automatic publishing with a cron timer every hour
 */
function initAutoPublish() {
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    // Fetch posts whose publishDate <= now and mark them as public
    const posts = await BlogEngine.getPublishedPosts();
    console.log(`Auto-publish check at ${now.toISOString()}, found ${posts.length} posts.`);
  });
}

module.exports = { initAutoPublish };
// --- REPLACE END ---
