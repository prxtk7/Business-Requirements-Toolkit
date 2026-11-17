/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Pages are split per feature in src/app/routes.tsx. These groups keep the
        // remaining chunks few and cache-friendly instead of many tiny shared files.
        codeSplitting: {
          groups: [
            // Framework code: changes only when dependencies change, so it caches well.
            { name: 'vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 2 },
            // App code and icons used by more than one chunk (UI kit, hooks, domain helpers).
            { name: 'shared', test: /[\\/](src|node_modules[\\/]lucide-react)[\\/]/, minShareCount: 2, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    // Integration tests render the whole app and type through userEvent; 5 s is too tight on a busy machine.
    testTimeout: 20_000,
  },
});
