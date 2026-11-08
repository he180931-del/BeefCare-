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
        '/oauth2': {
          target: 'http://localhost:8080',
          // Make Spring build the callback on the backend origin registered
          // in Google Cloud. The browser still sends the session cookie to
          // localhost on the callback, so OAuth state validation remains
          // server-side and does not depend on the Vite port.
          changeOrigin: true,
        },
        '/login/oauth2': {
          target: 'http://localhost:8080',
          // Keep the callback proxy available for deployments that return
          // through the frontend origin, while the normal Google callback is
          // the backend localhost URI above.
          changeOrigin: true,
        },
      },
    },
  }
})
