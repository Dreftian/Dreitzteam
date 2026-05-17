/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { base: 'var(--bg-base)', elev: 'var(--bg-elev)', card: 'var(--bg-card)', hover: 'var(--bg-hover)' },
        fg: { DEFAULT: 'var(--fg)', muted: 'var(--fg-muted)', subtle: 'var(--fg-subtle)' },
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)' },
        border: { DEFAULT: 'var(--border)' }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
