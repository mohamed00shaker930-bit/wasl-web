import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Plain SPA. In dev, /api and /files are proxied to wasl-api so the app is same-origin exactly as in production (Caddy).
export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss(), tsconfigPaths()],
  server: { port: 5173, proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: false }, "/files": "http://127.0.0.1:3000" } },
  build: { sourcemap: false },
});
