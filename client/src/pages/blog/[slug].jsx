// File: client/src/pages/blog/[slug].jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getArticleBySlug } from '../../utils/contentPublisher.js';
import { SeoMeta } from '../../utils/seoMeta.js';

export default function BlogPost() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);

  useEffect(() => {
    async function fetchArticle() {
      const data = await getArticleBySlug(slug);
      setArticle(data);
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
        <img src={image} alt={title} />
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
    </>
  );
}