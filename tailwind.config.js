/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F6F7',
        surface: '#FFFFFF',
        ink: '#14181C',
        'ink-muted': '#5C6670',
        line: '#E1E5EA',
        'accent-blue': '#2B6CB0',
        'accent-amber': '#D98C2B',
        'accent-green': '#2F8F5B',
        'accent-red': '#C1443C',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}     