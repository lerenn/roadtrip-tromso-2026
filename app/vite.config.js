import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@trip': root,
    },
  },
  server: {
    proxy: {
      // Avoid CORS issues talking to public OSRM from the browser
      '/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/osrm/, ''),
      },
    },
  },
})
