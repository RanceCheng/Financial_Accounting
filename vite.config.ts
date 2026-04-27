import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
