/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'deep-space': '#02050b',
        'mars': '#ff8f68',
        'mars-light': '#ffb08e',
        'tech-blue': '#79bbff',
        'ice': '#f5fbff',
      },
      fontFamily: {
        display: ['Sora', 'Space Grotesk', 'sans-serif'],
        body: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
