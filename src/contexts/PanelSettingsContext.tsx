import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect, ReactNode, useContext, createContext } from 'react';

interface PanelSettings {
	showOpenedItems: boolean;
	showVisualization: boolean;
}

interface PanelSettingsContextType {
	settings: PanelSettings;
	setSettings: (settings: PanelSettings) => void;
	togglePanel: (panel: keyof PanelSettings) => void;
}

const PanelSettingsContext = createContext<undefined | PanelSettingsContextType>(undefined);

export const PanelSettingsProvider = ({ children }: { children: ReactNode }) => {
	const [settings, setSettings] = useState<PanelSettings>({
		showOpenedItems: false,
		showVisualization: false
	});

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const savedSettings = await invoke<{ show_opened_items: boolean; show_visualization: boolean }>('get_panel_settings');
				setSettings({
					showOpenedItems: savedSettings.show_opened_items,
					showVisualization: savedSettings.show_visualization
				});
			} catch (err) {
				console.error('Failed to load panel settings:', err);
			}
		};
		loadSettings();
	}, []);

	const saveSettings = async (newSettings: PanelSettings) => {
		try {
			await invoke('set_panel_settings', {
				settings: {
					show_opened_items: newSettings.showOpenedItems,
					show_visualization: newSettings.showVisualization
				}
			});
		} catch (err) {
			console.error('Failed to save panel settings:', err);
		}
	};

	const updateSettings = (newSettings: PanelSettings) => {
		setSettings(newSettings);
		saveSettings(newSettings);
	};

	const togglePanel = (panel: keyof PanelSettings) => {
		const newSettings = { ...settings, [panel]: !settings[panel] };
		updateSettings(newSettings);
	};

	return (
		<PanelSettingsContext.Provider value={{ settings, togglePanel, setSettings: updateSettings }}>
			{children}
		</PanelSettingsContext.Provider>
	);
};

export const usePanelSettings = () => {
	const context = useContext(PanelSettingsContext);
	if (!context) {
		throw new Error('usePanelSettings must be used within PanelSettingsProvider');
	}
	return context;
};
