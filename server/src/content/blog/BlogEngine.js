// src/content/blog/BlogEngine.js  (Server-side)

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import marked from 'marked';
import Post from '../api/models/Post.js';

export class BlogEngine {
  /**
   * Luo uuden blogikirjoituksen tallentaen tietokantaan ja tiedostojärjestelmään
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
    const filePath = path.join(process.cwd(), 'src/content/blog/posts', filename);
    const frontmatter = matter.stringify(contentMarkdown, { title, date: publishDate });
    fs.writeFileSync(filePath, frontmatter);

    return newPost;
  }

  /**
   * Hakee julkaistut postaukset renderöitynä HTML:ksi
   */
  static async getPublishedPosts() {
    const posts = await Post.find({ publishDate: { $lte: new Date() } }).sort({ publishDate: -1 });
    return posts.map((post) => {
      const filePath = path.join(process.cwd(), 'src/content/blog/posts', `${post.slug}.md`);
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
