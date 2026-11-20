import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const FRONTEND_DIR = fileURLToPath(new URL('.', import.meta.url))
const NO_DEMO = fileURLToPath(new URL('./src/demo/noDemo.ts', import.meta.url))
/** This app's own sources, as Rollup names them (forward slashes; drive letter case differs on Windows). */
const SRC = fileURLToPath(new URL('./src/', import.meta.url)).split('\\').join('/').toLowerCase()
/** Modules (path under src/) that only exist for the demo data. None of them may reach a bundle built without demo data. */
const DEMO_PATH = /^(demo\/(demoModules|useDemoState)|features\/[^/]+\/data\/|data\/|api\/(client|herdDomainApi|collectionSchemas|storageMigrations|demoCattlePhotos|penApi|testUtils)\.ts|features\/[^/]+\/api\/\w+LocalApi\.ts)/
const demoModuleOf = (id) => {
  const file = id.split('\\').join('/')
  return file.toLowerCase().startsWith(SRC) && DEMO_PATH.test(file.slice(SRC.length)) ? `src/${file.slice(SRC.length)}` : null
}

/**
 * Demo data enters the app only through `src/demo/demoModules.ts`. Without demo data (`vite build`, `vite` on the real
 * backend) that door resolves to `src/demo/noDemo.ts`, and the bundle is checked for any demo module that still slipped in.
 */
function demoDoor(withDemo) {
  return {
    name: 'beefcare-demo-door',
    enforce: 'pre',
    resolveId(source) {
      return !withDemo && /(^|\/)demo\/demoModules(\.ts)?$/.test(source) ? NO_DEMO : null
    },
    generateBundle(_options, bundle) {
      if (withDemo) return
      const leaked = Object.values(bundle).flatMap((chunk) => (chunk.type === 'chunk' ? chunk.moduleIds : [])).map(demoModuleOf).filter(Boolean)
      if (leaked.length) this.error(`Bundle không được chứa dữ liệu mẫu, còn ${leaked.length} module:\n${leaked.sort().join('\n')}`)
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // `npm run dev:mock`: toàn bộ màn hình chạy bằng dữ liệu mock, không cần backend hay file .env.
  if (mode === 'mock') {
    process.env.VITE_BEEFCARE_DATA_SOURCE = 'local'
    process.env.VITE_BEEFCARE_AUTH_MODE = 'mock'
  }
  if (mode === 'backend') {
    process.env.VITE_BEEFCARE_DATA_SOURCE = 'backend'
    process.env.VITE_BEEFCARE_AUTH_MODE = 'backend'
  }
  // frontend/.env is read from this folder, whatever directory vite is started from; an empty value means backend, as at runtime.
  const runtime = loadEnv(mode, FRONTEND_DIR, 'VITE_BEEFCARE_')
  if (command === 'build') {
    // Bản build chỉ đọc dữ liệu thật: đặt local/mock là lỗi cấu hình, không lặng lẽ ra bản dùng dữ liệu mẫu.
    if ((runtime.VITE_BEEFCARE_DATA_SOURCE || 'backend') !== 'backend' || runtime.VITE_BEEFCARE_AUTH_MODE === 'mock') {
      throw new Error('vite build chỉ cho phép VITE_BEEFCARE_DATA_SOURCE=backend và không cho VITE_BEEFCARE_AUTH_MODE=mock; dữ liệu mẫu chỉ dùng với npm run dev:mock và Vitest.')
    }
  }
  const withDemo = runtime.VITE_BEEFCARE_DATA_SOURCE === 'local' || runtime.VITE_BEEFCARE_AUTH_MODE === 'mock'
  const env = loadEnv(mode, FRONTEND_DIR, 'BEEFCARE_DEV_HTTPS_')
  const cert = env.BEEFCARE_DEV_HTTPS_CERT
  const key = env.BEEFCARE_DEV_HTTPS_KEY
  if (Boolean(cert) !== Boolean(key)) throw new Error('Cần đặt cả BEEFCARE_DEV_HTTPS_CERT và BEEFCARE_DEV_HTTPS_KEY để bật HTTPS.')
  return {
    plugins: [demoDoor(withDemo), react(), tailwindcss()],
    server: {
      https: cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined,
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
