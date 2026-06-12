import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_R2_WORKER_URL": JSON.stringify(process.env.VITE_R2_WORKER_URL ?? "http://localhost:8787"),
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
