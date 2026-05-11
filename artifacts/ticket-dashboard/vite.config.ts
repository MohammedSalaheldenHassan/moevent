import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const artifactRoot = path.resolve(import.meta.dirname);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, artifactRoot, "");
  const apiProxyTarget =
    process.env.API_SERVER_URL ??
    env.VITE_DEV_API_PROXY ??
    "http://127.0.0.1:3001";

  const apiProxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  } as const;

  return {
    base: basePath,
    envDir: path.resolve(artifactRoot, "..", ".."),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(artifactRoot, "src"),
        "@assets": path.resolve(artifactRoot, "..", "..", "attached_assets"),
      },
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
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: apiProxy,
    },
  };
});
