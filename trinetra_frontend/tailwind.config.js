/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060D1A',
          900: '#0A1628',
          800: '#0F2040',
          700: '#162B55',
          600: '#1E3A5F',
          500: '#2A4F7A',
        },
        trinetra: {
          blue: '#2563EB',
          'blue-light': '#3B82F6',
          'blue-glow': '#60A5FA',
          green: '#10B981',
          'green-light': '#34D399',
          red: '#EF4444',
          'red-light': '#F87171',
          amber: '#F59E0B',
          purple: '#8B5CF6',
        },
        surface: {
          DEFAULT: '#F1F5F9',
          dark: '#E2E8F0',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(37, 99, 235, 0.3)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.3)',
        card: '0 4px 24px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.12)',
      },
      backgroundImage: {
        'gradient-naval': 'linear-gradient(135deg, #0A1628 0%, #162B55 50%, #1E3A5F 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
