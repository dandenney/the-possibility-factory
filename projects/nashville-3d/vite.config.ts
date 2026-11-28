import { defineConfig } from "vite";

// three.js alone is ~600 kB minified; the 14 MB model is the real download.
export default defineConfig({
  build: { target: "es2023", chunkSizeWarningLimit: 800 },
});
