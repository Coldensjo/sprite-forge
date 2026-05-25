import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect, ReactNode, useContext, createContext } from 'react';

export interface GeneralSettings {
	listAmountObjects: number;
	listAmountSprites: number;
}

interface GeneralSettingsContextType {
	settings: GeneralSettings;
	setSettings: (settings: GeneralSettings) => void;
}

const DEFAULT_SETTINGS: GeneralSettings = {
	listAmountObjects: 100,
	listAmountSprites: 100
};

const GeneralSettingsContext = createContext<undefined | GeneralSettingsContextType>(undefined);

export const GeneralSettingsProvider = ({ children }: { children: ReactNode }) => {
	const [settings, setSettingsState] = useState<GeneralSettings>(DEFAULT_SETTINGS);

	useEffect(() => {
		invoke<{ list_amount_objects: number; list_amount_sprites: number }>('get_general_settings')
			.then((saved) => {
				setSettingsState({
					listAmountObjects: saved.list_amount_objects,
					listAmountSprites: saved.list_amount_sprites
				});
			})
			.catch((err) => {
				console.error('Failed to load general settings:', err);
			});
	}, []);

	const setSettings = (next: GeneralSettings) => {
		setSettingsState(next);
		invoke('set_general_settings', {
			settings: {
				list_amount_objects: next.listAmountObjects,
				list_amount_sprites: next.listAmountSprites
			}
		}).catch((err) => {
			console.error('Failed to save general settings:', err);
		});
	};

	return <GeneralSettingsContext.Provider value={{ settings, setSettings }}>{children}</GeneralSettingsContext.Provider>;
};

export const useGeneralSettings = () => {
	const context = useContext(GeneralSettingsContext);
	if (!context) {
		throw new Error('useGeneralSettings must be used within GeneralSettingsProvider');
	}
	return context;
};
