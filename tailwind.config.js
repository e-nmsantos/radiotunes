/** Config do Tailwind — espelha a configuração que estava inline no index.html */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // slate-500 mais claro: contraste WCAG AA (≥ 4,5:1) sobre slate-950/900/800
        slate: { 500: '#8190a6' },
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
        },
      },
    },
  },
  plugins: [],
};
