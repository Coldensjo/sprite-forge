import type { Theme } from '@/lib/themes/types';

import themesData from '@/lib/themes/themes.json';
import { defaultTheme } from '@/lib/themes/default';
import { applyTheme, exportTheme, importTheme, validateTheme } from '@/lib/themes/utils';
import { useMemo, useState, useEffect, ReactNode, useContext, createContext } from 'react';

interface ThemeContextType {
	themes: Theme[];
	isDark: boolean;
	currentTheme: Theme;
	toggleDarkMode: () => void;
	setTheme: (theme: Theme) => void;
	exportCurrentTheme: () => string;
	setThemeByName: (name: string) => void;
	importThemeFromJson: (json: string) => void;
}

const ThemeContext = createContext<undefined | ThemeContextType>(undefined);

const THEME_STORAGE_KEY = 'sprite-forge-theme';
const DARK_MODE_STORAGE_KEY = 'sprite-forge-dark-mode';

const CUSTOM_THEMES_STORAGE_KEY = 'sprite-forge-custom-themes';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
	const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
		try {
			const saved = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});
	const [isDark, setIsDark] = useState<boolean>(() => {
		const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
		return saved ? JSON.parse(saved) : true;
	});

	const themes = useMemo(() => [...(themesData as Theme[]), ...customThemes], [customThemes]);

	useEffect(() => {
		const loadTheme = () => {
			try {
				const savedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
				if (savedThemeName) {
					const theme = themes.find((t) => t.name === savedThemeName);
					if (theme) {
						setCurrentTheme(theme);
					}
				}
			} catch (err) {
				console.error('Failed to load theme:', err);
			}
		};

		loadTheme();
	}, [themes]);

	useEffect(() => {
		applyTheme(currentTheme, isDark);
		localStorage.setItem(THEME_STORAGE_KEY, currentTheme.name);
		localStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(isDark));

		const root = document.documentElement;
		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}, [currentTheme, isDark]);

	const setTheme = (theme: Theme) => {
		setCurrentTheme(theme);
	};

	const setThemeByName = (name: string) => {
		const theme = themes.find((t) => t.name === name);
		if (theme) {
			setCurrentTheme(theme);
		}
	};

	const toggleDarkMode = () => {
		setIsDark((prev) => !prev);
	};

	const exportCurrentTheme = () => {
		return exportTheme(currentTheme);
	};

	const importThemeFromJson = (json: string) => {
		try {
			const theme = importTheme(json);
			if (validateTheme(theme)) {
				setCurrentTheme(theme);

				const existingCustom = customThemes.find((t) => t.name === theme.name);
				if (!existingCustom) {
					const builtInTheme = (themesData as Theme[]).find((t) => t.name === theme.name);
					if (!builtInTheme) {
						const updatedCustomThemes = [...customThemes, theme];
						setCustomThemes(updatedCustomThemes);
						localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(updatedCustomThemes));
					}
				}
			} else {
				throw new Error('Invalid theme format');
			}
		} catch (err) {
			console.error('Failed to import theme:', err);
			throw err;
		}
	};

	return (
		<ThemeContext.Provider
			value={{
				themes,
				isDark,
				setTheme,
				currentTheme,
				setThemeByName,
				toggleDarkMode,
				exportCurrentTheme,
				importThemeFromJson
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};
