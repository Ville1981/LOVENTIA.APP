// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',     // sinertävä pääväri (käytössä painikkeissa)
        secondary: '#f97316'    // oranssi vaihtoehto (varalla tulevaan käyttöön)
      }
    },
  },
  plugins: [],
};
