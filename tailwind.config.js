/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./v2/**/*.html",
    "./v2/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        op: {
          burgundy:         '#6b2737',
          'burgundy-dark':  '#4d1a27',
          'burgundy-deeper':'#3a1320',
          gold:             '#c9973a',
          'gold-light':     '#e8d5b0',
          parchment:        '#fdf8f0',
          cream:            '#f5ede0',
          'cream-dark':     '#ece0d0',
          ink:              '#1a1208',
          'ink-muted':      '#3d2b1f',
          'ink-light':      '#5a4535',
          'ink-subtle':     '#7a6a5a',
          'ink-faint':      '#a09080',
          tan:              '#c4b09a',
          'tan-light':      '#d4c5b0',
          'input-bg':       '#fffcf7',
          'amber-dark':     '#7a4a1e',
          'amber-darker':   '#5e3816',
          'amber-deepest':  '#4a2a10',
        },
      },
    },
  },
  plugins: [],
};
