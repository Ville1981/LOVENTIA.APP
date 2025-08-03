// src/utils/seo/SchemaGenerator.js  (Server-side)

/**
 * Generoi Schema.org Article -JSON-LD -merkintä blogikirjoitukselle
 * @param {{ title:string, author:string, datePublished:string, url:string }} meta
 */
export function generateArticleSchema(meta) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    author: { "@type": "Person", name: meta.author },
    datePublished: meta.datePublished,
    mainEntityOfPage: { "@type": "WebPage", "@id": meta.url }
  };
}
