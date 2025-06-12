// postcss.config.cjs
// Updated to use the new PostCSS plugin package for Tailwind CSS

module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
};
