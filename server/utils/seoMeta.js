// File: client/src/utils/seoMeta.js

import React from 'react';
import { Helmet } from 'react-helmet';

/**
 * SeoMeta
 * React component to inject meta tags for SEO and social sharing.
 * @param {{ title: string, description: string, url: string, image?: string }} props
 */
export function SeoMeta({ title, description, url, image }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
