/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // En pruebas no se registra el service worker: estorbaría en jsdom.
      disable: process.env.NODE_ENV === "test",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Dodoco Store",
        short_name: "Dodoco",
        description: "Registro de ventas para ferias",
        theme_color: "#111111",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    // Sin sourcemaps en producción: no exponer el código fuente.
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
