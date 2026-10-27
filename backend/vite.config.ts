import { URL, fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      app: fileURLToPath(new URL('./src/main/webapp/app/', import.meta.url)),
    },
  },
});
