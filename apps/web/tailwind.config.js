/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { brita: { 50: '#fff7ed', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 950: '#1c0a00' } },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 12px 40px rgba(249, 115, 22, .16)' },
    },
  },
  plugins: [],
}
