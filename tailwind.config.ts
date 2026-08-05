import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "lane-green": "#2d6a4f",
        "lane-amber": "#e9c46a",
        "lane-red": "#e76f51",
      },
    },
  },
  plugins: [],
};
export default config;
