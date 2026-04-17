import type { Config } from "tailwindcss";

/**
 * Kip It Real — Tailwind configuration.
 *
 * Brand tokens are exposed as semantic color names so components never
 * reference raw hex values directly. This keeps the visual system
 * consistent and makes future theming trivial.
 *
 * Usage examples:
 *   bg-brand-primary   → oxblood
 *   text-brand-text    → charcoal
 *   ring-brand-accent  → gold
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-primary": "#5A1E24", // Oxblood
        "brand-accent": "#C89B3C",  // Rich Gold
        "brand-bg": "#F5F1E8",      // Bone
        "brand-text": "#1E1E1E",    // Charcoal
        "brand-support": "#8A6A47", // Leather Tan

        // Subtle tints used for cards / hover states so we don't re-derive them.
        "brand-primary-soft": "#7A353C",
        "brand-accent-soft": "#E0B965",
        "brand-bg-deep": "#EBE4D3",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30, 30, 30, 0.04), 0 8px 24px rgba(30, 30, 30, 0.06)",
        "card-hover":
          "0 2px 4px rgba(30, 30, 30, 0.05), 0 12px 32px rgba(30, 30, 30, 0.10)",
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
