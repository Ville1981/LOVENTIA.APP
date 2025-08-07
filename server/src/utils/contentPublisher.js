// server/src/utils/contentPublisher.js
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const SCHEDULE_FILE = path.join(CONTENT_DIR, 'schedule.yaml');

/**
 * Publish all scheduled articles whose publishDate <= now.
 * Moves file from drafts/ to posts/ and updates schedule.
 */
export async function publishScheduledArticles() {
  const now = new Date();
  let schedule = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || [];

  const toPublish = schedule.filter(item => new Date(item.publishDate) <= now);
  if (!toPublish.length) return;

  for (const item of toPublish) {
    const draftPath = path.join(CONTENT_DIR, 'drafts', item.filename);
    const postPath = path.join(CONTENT_DIR, 'posts', item.filename);
    fs.renameSync(draftPath, postPath);
    console.log(`Published: ${item.filename}`);
  }

  // Remove published items from schedule
  schedule = schedule.filter(item => new Date(item.publishDate) > now);
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(schedule));
}
