import type { Theme } from './types';

export const applyTheme = (theme: Theme, isDark: boolean = false) => {
	const colors = isDark ? theme.colors.dark : theme.colors.light;
	const root = document.documentElement;

	Object.entries(colors).forEach(([key, value]) => {
		const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
		root.style.setProperty(cssVar, value);
	});
};

export const exportTheme = (theme: Theme): string => {
	return JSON.stringify(theme, null, 2);
};

export const importTheme = (json: string): Theme => {
	const theme = JSON.parse(json) as Theme;
	if (!theme.name || !theme.displayName || !theme.colors) {
		throw new Error('Invalid theme format');
	}
	return theme;
};

export const validateTheme = (theme: unknown): theme is Theme => {
	if (typeof theme !== 'object' || theme === null) return false;

	const t = theme as Record<string, unknown>;
	if (typeof t.name !== 'string' || typeof t.displayName !== 'string') return false;
	if (typeof t.colors !== 'object' || t.colors === null) return false;

	const colors = t.colors as Record<string, unknown>;
	if (typeof colors.light !== 'object' || typeof colors.dark !== 'object') return false;

	return true;
};
