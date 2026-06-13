import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/upload": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/raw": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/clips": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
