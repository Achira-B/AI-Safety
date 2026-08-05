/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F9FF",
        card: "#ffffff",
        line: "#E1E4EF",
        ink: "#0B1C30",
        navy: "#131B2E",
        soft: "#6E7280",
        faint: "#9098A6",
        accent: "#4648D4",
        accentSoft: "#EEF0FF",
        good: "#0C8A7E",
        goodSoft: "#E4F7F4",
        warn: "#B07D12",
        bad: "#B42318",
        badSoft: "#FDF0EE",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,28,48,0.04), 0 1px 8px rgba(11,28,48,0.05)",
        pop: "0 8px 30px rgba(11,28,48,0.14)",
      },
      borderRadius: {
        xl2: "14px",
      },
      letterSpacing: {
        kicker: "0.12em",
      },
    },
  },
  plugins: [],
};
