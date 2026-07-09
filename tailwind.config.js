module.exports = {
  darkMode: 'class',
  content: [
    './index.md',
    './_layouts/**/*.html',
    './_includes/**/*.html'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Playfair Display', 'Noto Serif SC', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
