/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./**/*.tsx"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0B0C10",
          800: "#12141A",
          700: "#191C24",
          600: "#232734",
          500: "#2D3344",
          400: "#3A4259",
          300: "#4B5574",
          200: "#6E7AA0",
          100: "#A5B1D6"
        },
        haze: {
          50: "#F4F6FB",
          100: "#E8EDF7",
          200: "#D7E0F2",
          300: "#C4D0EA",
          400: "#AAB9E0",
          500: "#8FA2D4"
        },
        accent: {
          50: "#EEFCF8",
          100: "#D5F7EE",
          200: "#AEF0DE",
          300: "#7AE4CA",
          400: "#36C9B8",
          500: "#30B5A6",
          600: "#2BA193",
          700: "#1E7D72",
          800: "#1A635B",
          900: "#174F49"
        },
        mint: {
          400: "#59E0B0",
          500: "#35C89A",
          600: "#1FA27A"
        },
        ember: {
          400: "#F3A86B",
          500: "#EC7B44",
          600: "#D85A2A"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(43, 161, 147, 0.25), 0 8px 24px rgba(11, 12, 16, 0.35)",
        "glow-accent": "0 0 60px -15px hsl(173 58% 45% / 0.4)",
        panel: "0 12px 32px rgba(11, 12, 16, 0.08)"
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, hsl(173 58% 40%) 0%, hsl(173 58% 50%) 100%)"
      }
    }
  },
  plugins: []
}
