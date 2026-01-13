/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#faf7ff",
          100: "#f4edff",
          200: "#e7dbff",
          300: "#d0baff",
          400: "#b28eff",
          500: "#9b68ff",
          600: "#8549ff",
          700: "#6d34e6",
          800: "#5529b3",
          900: "#3f2080"
        },
        blush: {
          50: "#fff5fb",
          100: "#ffe6f3",
          200: "#ffc2e2",
          300: "#ff93c9",
          400: "#ff5aa8",
          500: "#ff2e8b",
          600: "#e61f73",
          700: "#b31556",
          800: "#7f0f3f",
          900: "#520a29"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(155,104,255,.35), 0 12px 40px rgba(155,104,255,.18)"
      }
    }
  },
  plugins: []
}
