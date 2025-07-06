/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // The main HTML entry:
    "./index.html",
    // All static HTML in public/
    "./public/**/*.html",
    // All JS/TS/JSX/TSX and CSS files in src/
    "./src/**/*.{js,jsx,ts,tsx,css}"
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs:   '320px',   // extra small devices
      sm:   '640px',   // small devices
      md:   '768px',   // medium devices
      lg:   '1024px',  // large devices
      xl:   '1280px',  // extra large devices
      '2xl':'1536px',  // double extra large
    },
    extend: {
      colors: {
        primary:   '#FF4081',  // pinkki korostus
        secondary: '#005FFF',  // sininen korostus
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    // Lisää muita plugin-require-kutsuja tarpeen mukaan
  ],
}
