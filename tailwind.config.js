/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.jsx"
  ],
  theme: {
    extend: {
      colors: {
        'cyber-cyan': '#00ffff',
        'cyber-magenta': '#ff00ff',
        'cyber-green': '#00ff00'
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}