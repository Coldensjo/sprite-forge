import React from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface LuaPanelMeta {
	id: string;
	dock: string;
	title: string;
	menu: boolean;
}

interface LuaPanelsState {
	reload: () => void;
	panels: LuaPanelMeta[];
	toggle: (id: string) => void;
	isVisible: (id: string) => boolean;
}

const KEY = 'forge-lua-hidden';

const loadHidden = (): Set<string> => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return new Set(JSON.parse(raw) as string[]);
	} catch {
		void 0;
	}
	return new Set();
};

const LuaPanelsContext = React.createContext<LuaPanelsState>({
	panels: [],
	toggle: () => {},
	reload: () => {},
	isVisible: () => true
});

export const LuaPanelsProvider = ({ children }: { children: React.ReactNode }) => {
	const [panels, setPanels] = React.useState<LuaPanelMeta[]>([]);
	const [hidden, setHidden] = React.useState<Set<string>>(loadHidden);

	const reload = React.useCallback(() => {
		invoke<LuaPanelMeta[]>('forge_panel_list')
			.then(setPanels)
			.catch((e) => console.error('forge_panel_list failed', e));
	}, []);

	React.useEffect(() => {
		reload();
	}, [reload]);

	const isVisible = React.useCallback((id: string) => !hidden.has(id), [hidden]);

	const toggle = React.useCallback((id: string) => {
		setHidden((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			localStorage.setItem(KEY, JSON.stringify([...next]));
			return next;
		});
	}, []);

	const value = React.useMemo(() => ({ panels, toggle, reload, isVisible }), [panels, toggle, reload, isVisible]);

	return <LuaPanelsContext.Provider value={value}>{children}</LuaPanelsContext.Provider>;
};

export const useLuaPanels = () => React.useContext(LuaPanelsContext);
