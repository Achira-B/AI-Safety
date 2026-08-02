/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#faf9f7",
        card: "#ffffff",
        line: "#e8e5e1",
        ink: "#1c1917",
        soft: "#78716c",
        faint: "#a8a29e",
        accent: "#4f46e5",
        accentSoft: "#eef2ff",
        good: "#15803d",
        warn: "#b45309",
        bad: "#b91c1c",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,23,0.04), 0 1px 8px rgba(28,25,23,0.04)",
        pop: "0 8px 30px rgba(28,25,23,0.12)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
