/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "2200px",
      "4xl": "2600px",
    },
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        opensans: ["Open Sans", "sans-serif"],
      },
      colors: {
        // Cutaway Explainer's accent (the design system had no green token).
        cutaway: { DEFAULT: "#4ADE80", soft: "#86EFAC", deep: "#16A34A", ink: "#052E16" },
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar"),
  ],
};
