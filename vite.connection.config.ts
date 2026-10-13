import { defineConfig } from 'vite';
// Connection acceptance is built independently of the core game.
export default defineConfig({
  publicDir: false,
  build: { outDir: 'dist-connection', emptyOutDir: true,
    rolldownOptions: { input: 'wallet-baseline.html' } },
});
