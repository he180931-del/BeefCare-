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
    // Long UI flows can pass 5s when the whole suite runs in parallel on a busy machine.
    testTimeout: 15000,
    // Report 5.1: độ phủ câu lệnh và nhánh (`npm run test:coverage`). Chỉ đo khi bật `--coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Vẫn xuất số đo khi còn test lỗi có sẵn ở feature khác; kết quả lỗi vẫn hiện trong log.
      reportOnFailure: true,
    },
  },
})
