/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dota 2 inspired colors
        'dota-bg': '#0d1117',
        'dota-card': '#161b22',
        'dota-border': '#30363d',
        'dota-text': '#c9d1d9',
        'dota-text-secondary': '#8b949e',
        'radiant': '#92a525',
        'radiant-light': '#c4d633',
        'dire': '#c23c2a',
        'dire-light': '#f04e3e',
        'gold': '#f0a30a',
        'gold-light': '#ffd700',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
