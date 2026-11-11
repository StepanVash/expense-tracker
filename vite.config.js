import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('tesseract.js')) return 'ocr'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('d3-') || id.includes('victory-vendor')) return 'd3-vendor'
          if (id.includes('recharts')) return 'charts'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'react-vendor'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
