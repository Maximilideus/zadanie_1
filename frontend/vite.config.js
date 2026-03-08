import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/admin": "http://localhost:3000",
      "/public": "http://localhost:3000",
      "/catalog": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/telegram": "http://localhost:3000",
      "/ping": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/dev": "http://localhost:3000",
    },
  },
});

