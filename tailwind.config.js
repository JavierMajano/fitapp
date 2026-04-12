/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#edfaf4",
          100: "#d0f3e3",
          200: "#a4e8cb",
          300: "#6dd6ab",
          400: "#38bc87",
          500: "#1a9e6e",   // primary green
          600: "#117f58",
          700: "#0d6346",
          800: "#0b4f38",
          900: "#083d2b",
        },
        surface: {
          DEFAULT: "#0f0f0f",
          card:    "#1a1a1a",
          input:   "#222222",
          border:  "#2e2e2e",
        },
        bulk:  "#f59e0b",   // amber  — bulking goal
        cut:   "#ef4444",   // red    — cutting goal
        maint: "#3b82f6",   // blue   — maintenance goal
      },
      fontFamily: {
        sans: ["System"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
