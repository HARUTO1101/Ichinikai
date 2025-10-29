import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      'fermina-expensive-bradly.ngrok-free.dev',
      '*.ngrok-free.app',
      '*.ngrok-free.dev',
    ],
  },
  plugins: [react()],
})