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
