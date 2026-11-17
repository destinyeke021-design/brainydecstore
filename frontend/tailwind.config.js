/** Design system: neutral stone palette + a single distinctive accent ("brand"). */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: "#0f766e", dark: "#115e59", light: "#ccfbf1" }, ink: "#1c1917" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
