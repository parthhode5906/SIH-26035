import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  // Same-origin API: the dev server proxies /api and /health to the backend,
  // so the PWA never makes cross-origin calls and never depends on how the
  // browser resolves "localhost" (v4 vs v6 address-family lottery was the
  // cause of the first-attempt login failure). Target uses the literal ::1
  // because the backend binds :: (dual-stack) — see .freebuff/run.md.
  server: {
    // Restrict the dev server to the loopback interface so it is reachable over
    // localhost without exposing the app on all network interfaces.
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://[::1]:8000' },
      '/health': { target: 'http://[::1]:8000' },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://[::1]:8000' },
      '/health': { target: 'http://[::1]:8000' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
