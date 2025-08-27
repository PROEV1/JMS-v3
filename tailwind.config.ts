
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			spacing: {
				'xs': '0.25rem',  /* 4px */
				'sm': '0.5rem',   /* 8px */
				'md': '1rem',     /* 16px */
				'lg': '1.5rem',   /* 24px */
				'xl': '2rem',     /* 32px */
				'2xl': '3rem',    /* 48px */
				'3xl': '4rem',    /* 64px */
				'section': '1.5rem', /* 24px - standard section spacing */
				'card': '1.25rem',   /* 20px - card padding */
				'compact': '0.75rem', /* 12px - compact elements */
			},
			fontFamily: {
				'sans': ['Inter', 'system-ui', 'sans-serif'],
				'inter': ['Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				'accent-pink': 'hsl(var(--accent-pink))',
				
				'accent-cream': 'hsl(var(--accent-cream))',
				// Brand colors
				'brand-teal': {
					DEFAULT: 'hsl(var(--brand-teal))',
					light: 'hsl(var(--brand-teal-light))',
					dark: 'hsl(var(--brand-teal-dark))'
				},
				'brand-pink': {
					DEFAULT: 'hsl(var(--brand-pink))',
					light: 'hsl(var(--brand-pink-light))',
					dark: 'hsl(var(--brand-pink-dark))'
				},
				'brand-cream': {
					DEFAULT: 'hsl(var(--brand-cream))',
					light: 'hsl(var(--brand-cream-light))',
					dark: 'hsl(var(--brand-cream-dark))'
				},
				'brand-blue': {
					DEFAULT: 'hsl(var(--brand-blue))',
					light: 'hsl(var(--brand-blue-light))',
					dark: 'hsl(var(--brand-blue-dark))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
