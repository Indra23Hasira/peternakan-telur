import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base harus sama persis dengan nama repo GitHub
export default defineConfig({
  plugins: [react()],
  base: '/peternakan-telur/',
  build: { chunkSizeWarningLimit: 1500 },
})
