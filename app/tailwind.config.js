/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"Manrope"', "sans-serif"],
      },
      colors: {
        glam: {
          gold: "#d6b25e",
          champagne: "#f3e3c2",
          ink: "#0c0a09",
          mocha: "#191512",
          velvet: "#151017",
          pearl: "#f8f4eb",
        },
      },
      boxShadow: {
        glow: "0 0 35px rgba(214, 178, 94, 0.35)",
        soft: "0 20px 60px rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        "glam-radial":
          "radial-gradient(1200px 600px at 10% -10%, rgba(214, 178, 94, 0.35), transparent 60%), radial-gradient(900px 600px at 110% 0%, rgba(121, 87, 24, 0.35), transparent 60%)",
      },
    },
  },
  plugins: [],
}
