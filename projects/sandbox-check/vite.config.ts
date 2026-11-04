import { defineConfig } from "vite";

// No CSP on the kit page on purpose: srcdoc and blob frames inherit the parent's policy, which would skew results.
export default defineConfig({
  build: { target: "es2023" },
});
