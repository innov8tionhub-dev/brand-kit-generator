import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Open Sans', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        brand: {
          blue: '#1D4ED8',
          yellow: '#FACC15',
          charcoal: '#111827',
          gray: '#9CA3AF',
          white: '#FFFFFF',
        }
      }
    }
  }
} satisfies Config

