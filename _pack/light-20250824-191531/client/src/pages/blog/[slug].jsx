// File: src/pages/blog/[slug].jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// --- REPLACE START: fix import paths to drop explicit “.js” extension ---
import { getArticleBySlug } from "../../utils/contentPublisher";
import { SeoMeta } from "../../utils/seoMeta";
// --- REPLACE END ---

export default function BlogPost() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const data = await getArticleBySlug(slug);
        setArticle(data);
      } catch (err) {
        console.error("Failed to load article:", err);
      }
    }
    fetchArticle();
  }, [slug]);

  if (!article) return <div>Loading...</div>;

  const { title, description, content, image, url } = article;

  return (
    <>
      <SeoMeta
        title={title}
        description={description}
        url={url}
        image={image}
      />
      <article>
        <h1>{title}</h1>
        {image && <img src={image} alt={title} />}
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
    </>
  );
}
