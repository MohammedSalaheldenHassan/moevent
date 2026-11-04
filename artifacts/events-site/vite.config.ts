import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "5175";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const artifactRoot = path.resolve(import.meta.dirname);

// /api (public stats) goes to the Express server, same as the dashboard.
const apiProxy = {
  "/api": {
    target: process.env.API_SERVER_URL ?? "http://127.0.0.1:3001",
    changeOrigin: true,
  },
} as const;

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  // Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the repo root .env
  envDir: path.resolve(artifactRoot, "..", ".."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(artifactRoot, "src") },
    dedupe: ["react", "react-dom"],
  },
  root: artifactRoot,
  build: {
    outDir: path.resolve(artifactRoot, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
    fs: { strict: true, deny: ["**/.*"] },
  },
  preview: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
  },
});
