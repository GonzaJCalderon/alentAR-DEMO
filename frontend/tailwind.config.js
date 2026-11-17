/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#b5ccbf',
        'primary-fixed': '#d1e8da',
        'on-primary': '#20342b',
        'primary-container': '#061a12',
        secondary: '#ffe2ab',
        'secondary-container': '#ffbf00',
        'on-secondary': '#1f1600',
        'on-secondary-container': '#6d5000',
        background: '#111415',
        'on-background': '#e1e3e4',
        surface: '#111415',
        'on-surface': '#e1e3e4',
        'surface-variant': '#323536',
        'on-surface-variant': '#c2c8c3',
        outline: '#8c928e',
        'outline-variant': '#424844',
        'surface-container-highest': '#323536',
        'surface-container-high': '#282a2b',
        'surface-container': '#1d2021',
      },
      fontFamily: {
        'headline-lg': ['"Bebas Neue"', 'sans-serif'],
        'display-lg': ['"Bebas Neue"', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'headline-md': ['"Bebas Neue"', 'sans-serif'],
        'label-sm': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

