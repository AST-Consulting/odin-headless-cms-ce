import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        highlight: {
          DEFAULT: "hsl(var(--highlight))",
          foreground: "hsl(var(--highlight-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px hsl(var(--primary) / 0.3)',
        'glow-md': '0 0 25px -5px hsl(var(--primary) / 0.4)',
        'glow-lg': '0 0 40px -10px hsl(var(--primary) / 0.5)',
        'glow-accent': '0 0 20px -5px hsl(var(--accent) / 0.4)',
        'glow-success': '0 0 20px -5px hsl(var(--success) / 0.4)',
        'glow-destructive': '0 0 20px -5px hsl(var(--destructive) / 0.4)',
        'elevated': '0 4px 6px -1px hsl(0 0% 0% / 0.3), 0 2px 4px -2px hsl(0 0% 0% / 0.2)',
        'elevated-lg': '0 10px 25px -5px hsl(0 0% 0% / 0.4), 0 0 20px -5px hsl(var(--primary) / 0.15)',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(180deg, hsl(230 25% 7%) 0%, hsl(230 25% 5%) 100%)',
        'gradient-card': 'linear-gradient(145deg, hsl(230 25% 11%) 0%, hsl(230 25% 8%) 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, hsl(230 25% 9%) 0%, hsl(230 25% 6%) 100%)',
        'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(217 91% 50%) 100%)',
        'gradient-accent': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
        'shimmer': 'linear-gradient(90deg, hsl(230 25% 12%) 0%, hsl(230 25% 18%) 50%, hsl(230 25% 12%) 100%)',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-from-bottom-full': 'slide-in-from-bottom-full 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-to-bottom-full': 'slide-out-to-bottom-full 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        // iOS-like animations
        'spring-bounce': 'spring-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-scale': 'spring-scale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-scale-in': 'fade-scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-scale-out': 'fade-scale-out 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up-fade': 'slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down-fade': 'slide-down-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-down': 'accordion-down 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-up': 'accordion-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-slide-in': 'toast-slide-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'toast-slide-out': 'toast-slide-out 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'button-press': 'button-press 0.15s ease-out',
        'rainbow': 'rainbow var(--speed, 2s) infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px -3px hsl(var(--primary) / 0.3)' },
          '50%': { boxShadow: '0 0 25px -3px hsl(var(--primary) / 0.5)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-from-bottom-full': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-out-to-bottom-full': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        // iOS-like keyframes
        'spring-bounce': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '70%': { transform: 'scale(1.03)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'spring-scale': {
          '0%': { transform: 'scale(0.95)' },
          '70%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'fade-scale-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.96)' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down-fade': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        'accordion-down': {
          '0%': { height: '0', opacity: '0' },
          '100%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
        },
        'accordion-up': {
          '0%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          '100%': { height: '0', opacity: '0' },
        },
        'toast-slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '70%': { transform: 'translateX(-5px)', opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'button-press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        'rainbow': {
          '0%': { backgroundPosition: '0%' },
          '100%': { backgroundPosition: '200%' },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;

