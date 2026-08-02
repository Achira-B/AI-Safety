/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0e1116",
        panel: "#161b22",
        edge: "#2a323d",
        muted: "#8b96a5",
        accent: "#7aa2f7",
        warn: "#e0af68",
        bad: "#f7768e",
        good: "#9ece6a",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
