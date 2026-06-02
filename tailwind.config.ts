import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy
        line: { green: "#06C755", dark: "#00B900" },
        // Design System
        primary:  { DEFAULT: "#FF4B6E", hover: "#E63D5F", light: "#FFE8EC" },
        accent:   { purple: "#7B5EA7", blue: "#4A90D9", orange: "#F5A623", teal: "#3DBCAA" },
        surface:  { dark: "#1E2340", dark2: "#2A3060", light: "#F5F6FA", card: "#FFFFFF", input: "#F0F1F7" },
        ds:       { text: "#1A1D2E", muted: "#8A90B0", onDark: "#FFFFFF", onDarkMuted: "#A0A8CC", border: "#E8E9F3", borderDark: "#3A4070" },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      fontSize: {
        "ds-xs":   ["12px", { lineHeight: "1.4" }],
        "ds-sm":   ["13px", { lineHeight: "1.5" }],
        "ds-base": ["15px", { lineHeight: "1.6" }],
        "ds-md":   ["17px", { lineHeight: "1.5" }],
        "ds-lg":   ["20px", { lineHeight: "1.4" }],
        "ds-xl":   ["24px", { lineHeight: "1.3" }],
        "ds-2xl":  ["32px", { lineHeight: "1.2" }],
      },
      borderRadius: {
        "ds-sm": "8px", "ds-md": "12px", "ds-lg": "16px", "ds-xl": "24px",
      },
      boxShadow: {
        "ds-sm":  "0 2px 8px rgba(30,35,64,0.08)",
        "ds-md":  "0 4px 16px rgba(30,35,64,0.12)",
        "ds-lg":  "0 8px 32px rgba(30,35,64,0.16)",
        "ds-fab": "0 6px 20px rgba(255,75,110,0.40)",
      },
    },
  },
  plugins: [],
};
export default config;
