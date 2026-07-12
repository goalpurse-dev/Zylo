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
    // @ffmpeg/ffmpeg spins up a Web Worker internally — Vite's dev-time
    // dependency pre-bundling rewrites that worker import in a way that
    // 404s at runtime, which leaves ffmpeg.load() hanging forever waiting
    // on a worker that never came up. Excluding both from pre-bundling
    // lets the package's own worker URL resolution work unmodified.
    exclude: ["react-icons", "@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
