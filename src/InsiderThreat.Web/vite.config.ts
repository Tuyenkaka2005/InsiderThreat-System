import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild', // Sử dụng ESBuild để minify và làm rối mã cơ bản
  },
  optimizeDeps: {
    include: ['@vladmandic/face-api'],
    esbuildOptions: {
      keepNames: true
    }
  }
})
