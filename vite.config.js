import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel's deployment kind ("production", "preview") at build time, for build switches such as
// VITE_CUTAWAY_ENABLED (src/data/cutawayExplainer.js). Unset outside Vercel.
if (process.env.VERCEL_ENV && !process.env.VITE_VERCEL_ENV) process.env.VITE_VERCEL_ENV = process.env.VERCEL_ENV;

export default defineConfig({
  plugins: [react()],

  css: {
    transformer: "none", // ensure Tailwind v3 uses PostCSS and NOT Lightning CSS
  },

  // Browser code can never be truly secret, but production output should expose
  // no readable source maps and should ship only minified, content-hashed files.
  build: {
    minify: "esbuild",
    sourcemap: false,
  },

  server: {
    proxy: {
      // Cutaway M2 owner testing: the local runner (scripts/cutaway/proto3d/m2/localServer.mjs), localhost only
      "/m2api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
    watch: {
      ignored: [
        "**/dist/**",
        "**/dist-ssr/**",
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
