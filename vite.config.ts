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
      "/.netlify/identity": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/.netlify/functions": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/key": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/clips": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/file": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/mod": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
      "/apk": {
        target: "https://rawbin.netlify.app",
        changeOrigin: true,
      },
    },
  },
});
