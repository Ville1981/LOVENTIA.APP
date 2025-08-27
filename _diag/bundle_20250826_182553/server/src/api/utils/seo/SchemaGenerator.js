// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

/**
 * Generates Schema.org Article JSON-LD for a blog post
 * @param {{ title:string, author:string, datePublished:string, url:string }} meta
 */
function generateArticleSchema(meta) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    author: { "@type": "Person", name: meta.author },
    datePublished: meta.datePublished,
    mainEntityOfPage: { "@type": "WebPage", "@id": meta.url }
  };
}

module.exports = { generateArticleSchema };
// --- REPLACE END ---
