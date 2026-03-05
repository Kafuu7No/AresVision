/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'deep-space': '#0a0a0f',
        'mars': '#c75b39',
        'mars-light': '#e8845a',
        'tech-blue': '#4a9eff',
        'ice': '#e8edf3',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Exo 2', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
