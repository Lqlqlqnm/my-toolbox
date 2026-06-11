import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'My Toolbox',
      short_name: 'Toolbox',
      description: '个人工具箱 — 记账 · ETF策略 · 旅行清单',
      theme_color: '#f59e0b',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  }), cloudflare()],
  build: {
    outDir: 'dist',
  },
})