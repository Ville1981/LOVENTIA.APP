// tailwind.config.js

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FF4081",      // pinkki korostus
        secondary: "#005FFF",    // sininen korostus
      },
    },
  },
  plugins: [
    require("@tailwindcss/line-clamp"),
    // Lisää tarvittaessa muita Tailwind-laajennuksia
  ],
};
