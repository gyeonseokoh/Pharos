import type { Config } from "tailwindcss";

export default {
	content: ["./src/**/*.{ts,tsx}"],
	// Obsidian의 기존 스타일을 리셋하지 않게 preflight 끔.
	// Tailwind 유틸리티는 우리 컴포넌트에 명시적으로 적용한 곳에서만 동작.
	corePlugins: { preflight: false },
	darkMode: ["class", ".theme-dark"],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					'"Pretendard Variable"',
					"Pretendard",
					"-apple-system",
					"BlinkMacSystemFont",
					'"Segoe UI"',
					"Roboto",
					"sans-serif",
				],
			},
			colors: {
				// Obsidian CSS 변수를 Tailwind 색상으로 매핑 — 다크/라이트 자동 대응
				bg: {
					primary: "var(--background-primary)",
					secondary: "var(--background-secondary)",
					modifier: "var(--background-modifier-border)",
				},
				text: {
					normal: "var(--text-normal)",
					muted: "var(--text-muted)",
					faint: "var(--text-faint)",
					accent: "var(--text-accent)",
				},
				accent: {
					DEFAULT: "var(--interactive-accent)",
					hover: "var(--interactive-accent-hover)",
				},
				success: "var(--color-green)",
				warning: "var(--color-orange)",
				danger: "var(--color-red)",
				info: "var(--color-blue)",
			},
			borderRadius: {
				lg: "var(--radius-l)",
				md: "var(--radius-m)",
				sm: "var(--radius-s)",
			},
		},
	},
	plugins: [],
} satisfies Config;
