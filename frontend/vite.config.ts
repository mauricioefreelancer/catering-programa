import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, mkdirSync } from 'fs'

// Genera dist/version.json con un hash único por build para que el frontend
// detecte el despliegue de una nueva versión y recargue la página sin F5.
const generarVersionJson = () => ({
  name: 'generar-version-json',
  apply: 'build' as const,
  closeBundle() {
    const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const content = JSON.stringify({ version: hash, atualizado: new Date().toISOString() })
    const outDir = this.dir ?? 'dist'
    try {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(`${outDir}/version.json`, content, 'utf8')
    } catch {
      // no romper el build si falla
    }
  },
})

export default defineConfig({
  plugins: [
    generarVersionJson(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon.svg', 'icons.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'ERP Vending & Catering',
        short_name: 'ERP V&C',
        description: 'Sistema ERP completo para Vending y Catering',
        theme_color: '#1677ff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'es-CO',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
})
