import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // 讓 dist/index.html 可直接用 file:// 開啟（僅打包時套用，不影響 dev server）
    {
      name: 'file-protocol-friendly',
      apply: 'build',
      transformIndexHtml(html: string) {
        return html
          // 移除 crossorigin，避免 file:// CORS 問題
          .replace(/ crossorigin/g, '')
          // type="module" 改為 defer，保留延遲執行行為（等 DOM 載入後才執行）
          .replace(/ type="module"/g, ' defer')
          // 移除 favicon（file:// 下 dist/ 內沒有 vite.svg）
          .replace(/<link rel="icon"[^>]*>/, '')
      },
    },
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api/yahoo-finance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-finance/, ''),
        secure: true,
      },
      '/api/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stooq/, ''),
        secure: true,
      },
    },
  },
})
