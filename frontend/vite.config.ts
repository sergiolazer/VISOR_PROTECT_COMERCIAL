import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel build: artefactos en /dist (raíz del monorepo). Local: frontend/dist.
const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@visor-protect/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: isVercel ? path.resolve(__dirname, '../dist') : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
