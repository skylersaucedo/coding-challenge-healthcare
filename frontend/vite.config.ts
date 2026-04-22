import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Forward /api/* to the local backend as-is (FastAPI routes start with /api/).
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
