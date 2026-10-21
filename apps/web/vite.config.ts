import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const target = process.env.CLUBPLAY_SERVER_URL ?? "http://localhost:3000";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      "/socket.io": { target, ws: true },
      "/api": { target },
    },
  },
  build: { manifest: true },
});
