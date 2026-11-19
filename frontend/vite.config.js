import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const NO_DEMO = fileURLToPath(new URL('./src/demo/noDemo.ts', import.meta.url))
/** Modules that only exist for the demo data. None of them may reach a bundle built without demo data. */
const DEMO_MODULE = /\/src\/(demo\/(demoModules|useDemoState)|features\/[^/]+\/data\/|data\/|api\/(client|herdDomainApi|collectionSchemas|storageMigrations|demoCattlePhotos|penApi|testUtils)\.ts|features\/[^/]+\/api\/\w+LocalApi\.ts)/

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
      const leaked = Object.values(bundle).flatMap((chunk) => (chunk.type === 'chunk' ? chunk.moduleIds : []))
        .map((id) => id.split('\\').join('/')).filter((id) => DEMO_MODULE.test(id))
      if (leaked.length) this.error(`Bundle không được chứa dữ liệu mẫu, còn ${leaked.length} module:\n${leaked.map((id) => id.replace(/^.*\/src\//, 'src/')).sort().join('\n')}`)
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
  if (command === 'build') {
    // Bản build chỉ đọc dữ liệu thật: đặt local/mock là lỗi cấu hình, không lặng lẽ ra bản dùng dữ liệu mẫu.
    const built = loadEnv(mode, process.cwd(), 'VITE_BEEFCARE_')
    if ((built.VITE_BEEFCARE_DATA_SOURCE ?? 'backend') !== 'backend' || built.VITE_BEEFCARE_AUTH_MODE === 'mock') {
      throw new Error('vite build chỉ cho phép VITE_BEEFCARE_DATA_SOURCE=backend và không cho VITE_BEEFCARE_AUTH_MODE=mock; dữ liệu mẫu chỉ dùng với npm run dev:mock và Vitest.')
    }
  }
  const runtime = loadEnv(mode, process.cwd(), 'VITE_BEEFCARE_')
  const withDemo = runtime.VITE_BEEFCARE_DATA_SOURCE === 'local' || runtime.VITE_BEEFCARE_AUTH_MODE === 'mock'
  const env = loadEnv(mode, process.cwd(), 'BEEFCARE_DEV_HTTPS_')
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
