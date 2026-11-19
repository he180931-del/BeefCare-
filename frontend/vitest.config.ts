import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/{unit,integration}/**/*.test.{ts,tsx}'],
    // node:test suites run by `npm run test:integration`, not Vitest.
    exclude: [...configDefaults.exclude, 'tests/integration/herd-entry/*.test.ts'],
    // The suite runs on the demo stores; frontend/.env usually points at the real backend. Tests that need the backend
    // adapter call vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend').
    env: { VITE_BEEFCARE_DATA_SOURCE: 'local' },
    clearMocks: true,
    restoreMocks: true,
    // Long UI flows can pass 5s when the whole suite runs in parallel on a busy machine.
    testTimeout: 15000,
  },
})
