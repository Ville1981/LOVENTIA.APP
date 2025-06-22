// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// __dirname isn’t built-in under ESM, so derive it:
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // So you can import with "@/..." from inside src/
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      // Allow serving from:
      // 1) your project root
      // 2) this folder under client/node_modules
      // 3) the sibling node_modules in the repo root
      allow: [
        path.resolve(__dirname),
        path.resolve(
          __dirname,
          'node_modules',
          'slick-carousel',
          'slick',
          'fonts'
        ),
        path.resolve(
          __dirname,
          '..',
          'node_modules',
          'slick-carousel',
          'slick',
          'fonts'
        ),
      ],
    },
  },
  build: {
    // keep your assetsDir so built CSS/JS can still find assets/
    assetsDir: 'assets',
  },
})
