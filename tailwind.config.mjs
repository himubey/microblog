/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        ui: ["Tahoma", "Verdana", "Arial", "sans-serif"],
      },
      colors: {
        sky: "#a8e6ef",
        "sky-deep": "#86cddd",
        panel: "#ffffff",
        border: "#c9d9e5",
        text: "#2b2b2b",
        muted: "#6d7f8d",
        link: "#2f79c5",
        accent: "#7ac943",
        "accent-dark": "#5aa62b",
      },
      boxShadow: {
        card: "0 2px 0 rgba(0,0,0,0.08)",
      },
      width: {
        shell: "980px",
      },
    },
  },
  plugins: [],
};
