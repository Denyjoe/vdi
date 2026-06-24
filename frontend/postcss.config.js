/**
 * PostCSS configuration for the DIT VDI frontend.
 *
 * Uses @tailwindcss/postcss plugin (Tailwind v4) for CSS processing
 * and autoprefixer for cross-browser vendor prefixing.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
