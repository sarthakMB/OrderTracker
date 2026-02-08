import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // "@/" maps to the "src/" folder so we can write clean imports like:
      // import { Button } from "@/components/ui/button"
      // instead of relative paths like "../../../components/ui/button"
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // During development, Vite runs on port 5173 and the backend runs on
    // port 3001. This proxy tells Vite: "any request starting with /api,
    // forward it to the backend instead of trying to serve it yourself."
    // This way the frontend can call fetch("/api/orders") and it Just Works.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
