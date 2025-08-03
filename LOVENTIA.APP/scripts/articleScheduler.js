#!/usr/bin/env node
// scripts/articleScheduler.js
import { publishScheduledArticles } from '../server/src/utils/contentPublisher.js';

(async () => {
  try {
    await publishScheduledArticles();
    console.log('Article scheduling run complete.');
  } catch (err) {
    console.error('Error in articleScheduler:', err);
    process.exit(1);
  }
})();
