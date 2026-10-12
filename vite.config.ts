import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), {
    name: 'setup-build-provenance',
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'setup-version.json', source: JSON.stringify({gameCommit: process.env.COMMIT_REF || process.env.GITHUB_SHA || 'local'})});
    },
  }],
  server: { host: "0.0.0.0" },
});
