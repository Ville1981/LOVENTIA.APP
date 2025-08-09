// --- REPLACE START: convert ESM to CommonJS; keep logic intact and fix paths ---
'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
// marked v4 exports a function; v5+ exports an object with .parse
const markedLib = require('marked');
const marked = (typeof markedLib === 'function')
  ? markedLib
  : (markedLib && typeof markedLib.parse === 'function' ? markedLib.parse : (s) => String(s));

// NOTE: This file is expected under server/src/content/blog/
// The posts directory is a sibling folder: server/src/content/blog/posts
const POSTS_DIR = path.resolve(__dirname, 'posts');

// Post model lives under server/src/api/models/Post.js
// Use a robust absolute path from this file location
const Post = require(path.resolve(__dirname, '../../api/models/Post.js'));

class BlogEngine {
  /**
   * Creates a new blog post by saving to DB and filesystem
   */
  static async createPost({ title, authorId, contentMarkdown, publishDate }) {
    // Save metadata to DB
    const newPost = await Post.create({
      title,
      author: authorId,
      publishDate,
      slug: BlogEngine.slugify(title),
    });

    // Save markdown file
    const filename = `${newPost.slug}.md`;
    const filePath = path.resolve(POSTS_DIR, filename);
    const frontmatter = matter.stringify(contentMarkdown, { title, date: publishDate });
    fs.writeFileSync(filePath, frontmatter);

    return newPost;
  }

  /**
   * Fetches published posts rendered as HTML
   */
  static async getPublishedPosts() {
    const posts = await Post.find({ publishDate: { $lte: new Date() } }).sort({ publishDate: -1 });
    return posts.map((post) => {
      const filePath = path.resolve(POSTS_DIR, `${post.slug}.md`);
      const file = fs.readFileSync(filePath, 'utf-8');
      const { content, data } = matter(file);
      const html = marked(content);
      return { metadata: data, html };
    });
  }

  static slugify(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}

module.exports = { BlogEngine };
// --- REPLACE END ---
