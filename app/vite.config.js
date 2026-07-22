import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Project Pages URL is /<repo>/ — set automatically in GitHub Actions. */
function pagesBase() {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  const repo = process.env.GITHUB_REPOSITORY // owner/name
  if (repo) return `/${repo.split('/')[1]}/`
  return '/'
}

export default defineConfig({
  base: pagesBase(),
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
