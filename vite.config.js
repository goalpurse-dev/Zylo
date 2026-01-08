import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  css: {
    transformer: "none", // ensure Tailwind v3 uses PostCSS and NOT Lightning CSS
  },

  server: {
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
