import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    allowedHosts: [
      'sde-intern-resources-queue-dashboard-frontend.vaacdq.easypanel.host'
    ]
  }
})
