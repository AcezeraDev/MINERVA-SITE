import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
// @ts-expect-error Server middleware is authored as an ESM helper.
import { handleGeminiRequest, loadLocalEnv } from "./gemini-server.mjs";
// @ts-expect-error Server middleware is authored as an ESM helper.
import { handleDataRequest } from "./data-server.mjs";

loadLocalEnv();

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    {
      name: "minerva-mine-api",
      configureServer(server) {
        // /api/gemini e o caminho legado; /api/mine/chat e o nome novo.
        const mineRoutes = ["/api/gemini", "/api/mine/chat"];
        for (const route of mineRoutes) {
          server.middlewares.use(route, async (req, res) => {
            await handleGeminiRequest(req, res);
          });
        }
        server.middlewares.use(async (req, res, next) => {
          const pathname = String((req as { url?: string }).url || "/").split("?")[0];
          if (!pathname.startsWith("/api/") || mineRoutes.includes(pathname)) {
            next();
            return;
          }
          await handleDataRequest(req, res);
        });
      },
    },
  ],
  server: {
    port: 5174,
  },
  build: {
    // Three.js fica em um chunk sob demanda de ~507 KB; o pacote inicial permanece bem abaixo disso.
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("pdfjs-dist")) return "pdf";
          if (id.includes("three")) return "three";
          if (id.includes("ogl")) return "ogl";
          if (id.includes("react") || id.includes("framer-motion") || id.includes("lucide-react")) return "ui-vendor";
          return undefined;
        },
      },
    },
  },
});
