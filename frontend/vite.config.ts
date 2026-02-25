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
  server: {
    port: 5173,
    proxy: {
      "/search": "http://127.0.0.1:5000",
      "/download": "http://127.0.0.1:5000",
      "/queue": "http://127.0.0.1:5000",
      "/check_downloaded": "http://127.0.0.1:5000",
      "/youtubedl": "http://127.0.0.1:5000",
      "/playlist": "http://127.0.0.1:5000",
      "/favorites": "http://127.0.0.1:5000",
      "/debug": "http://127.0.0.1:5000",
      "/downloads": "http://127.0.0.1:5000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
