import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          // 300 and 400 fill a gap the scale always had: everything between
          // "barely tinted" and "dark enough for white text" was missing, which
          // is exactly the range an accent on a dark background needs.
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#4338ca",
          600: "#3730a3",
          700: "#312e81",
          900: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
