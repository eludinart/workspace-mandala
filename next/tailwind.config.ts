import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

const slateSteps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const accentSteps = ['400', '500', '600', '700'] as const

const slateColors = Object.fromEntries(
  slateSteps.map((step) => [step, `rgb(var(--slate-${step}) / <alpha-value>)`])
)

const accentColors = Object.fromEntries(
  accentSteps.map((step) => [step, `rgb(var(--accent-${step}) / <alpha-value>)`])
)

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    colors: {
      inherit: colors.inherit,
      current: colors.current,
      transparent: colors.transparent,
      black: colors.black,
      white: colors.white,
      slate: slateColors,
      violet: accentColors,
      accent: {
        DEFAULT: 'rgb(var(--accent-500) / <alpha-value>)',
        hover: 'rgb(var(--accent-600) / <alpha-value>)',
        muted: 'rgb(var(--accent-500) / 0.12)',
        dark: 'rgb(var(--accent-400) / <alpha-value>)',
      },
      red: colors.red,
      amber: colors.amber,
      emerald: colors.emerald,
      sky: colors.sky,
      orange: colors.orange,
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
