import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/{unit,integration}/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
  },
})
