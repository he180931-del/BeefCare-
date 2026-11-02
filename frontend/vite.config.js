import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // `npm run dev:mock`: toàn bộ màn hình chạy bằng dữ liệu mock, không cần backend hay file .env.
  if (mode === 'mock') {
    process.env.VITE_BEEFCARE_DATA_SOURCE = 'local'
    process.env.VITE_BEEFCARE_AUTH_MODE = 'mock'
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
