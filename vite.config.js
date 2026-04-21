import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  css: {
    transformer: "none", // ensure Tailwind v3 uses PostCSS and NOT Lightning CSS
  },

  server: {
    proxy: {
      "/api/openai": {
        target: "https://api.openai.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ""),
      },
    },
    watch: {
      ignored: [
        "**/src/assets/**",
        "**/.tmp.driveupload/**",
        "**/.tmp.drivedownload/**",
        "**/.tmp.**",
      ],
    },
  },

  optimizeDeps: {
    exclude: ["react-icons"],
  },
});
