import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        spotify: {
          green: "#1DB954",
          black: "#121212",
          dark: "#181818",
          lightdark: "#282828",
          gray: "#b3b3b3",
        },
        party: {
          purple: "#a855f7",
          pink: "#ec4899",
          cyan: "#06b6d4",
          amber: "#f59e0b",
          red: "#ef4444",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
        "bounce-subtle": "bounce-subtle 1.5s ease-in-out infinite",
        "equalizer-1": "equalizer 1.2s ease-in-out infinite",
        "equalizer-2": "equalizer 0.8s ease-in-out infinite 0.2s",
        "equalizer-3": "equalizer 1.5s ease-in-out infinite 0.4s",
        "equalizer-4": "equalizer 0.9s ease-in-out infinite 0.1s",
      },
      keyframes: {
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        equalizer: {
          "0%, 100%": { height: "15%" },
          "50%": { height: "100%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
