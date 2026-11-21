/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
        border: 'var(--border)',
        focal: {
          DEFAULT: 'var(--focal)',
          bg: 'var(--focal-bg)',
        },
        accent: {
          lime: 'var(--accent-lime)',
          orange: 'var(--accent-orange)',
          orangeAccent: 'var(--accent-accent2)',
          orangeLight: 'var(--accent-accent3)',
          emerald: 'var(--accent-emerald)',
        },
        primaryText: 'var(--text-primary)',
        mutedText: 'var(--text-muted)',
      },
      borderRadius: {
        bento: 'var(--radius-bento)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
