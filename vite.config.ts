import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
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
    },
  },
});
