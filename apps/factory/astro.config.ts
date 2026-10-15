import netlify from "@astrojs/netlify";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: netlify({ devFeatures: { environmentVariables: false, images: true, edgeFunctions: false } }),
  vite: { plugins: [tailwindcss()] },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: "server", access: "secret" }),
      DATABASE_AUTH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      FACTORY_PASSWORD: envField.string({ context: "server", access: "secret", optional: true }),
      SESSION_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      GITHUB_DISPATCH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
