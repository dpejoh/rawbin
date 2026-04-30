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
        target: "https://yuribin.netlify.app",
        changeOrigin: true,
      },
      "^/(key|clips|file)(/.*)?$": {
        target: "https://yuribin.netlify.app",
        changeOrigin: true,
      },
    },
  },
});
