const KEY = 'lua:scriptsEnabled';

const store = (): Storage => {
	if (typeof window === 'undefined') return localStorage;
	const raw = (window as unknown as { __forgeRawStorage?: Storage }).__forgeRawStorage;
	return raw ?? window.localStorage;
};

export const isLuaEnabled = (): boolean => {
	try {
		const v = store().getItem(KEY);
		return v === null ? true : v === '1';
	} catch {
		return true;
	}
};

export const setLuaEnabled = (enabled: boolean): void => {
	try {
		store().setItem(KEY, enabled ? '1' : '0');
	} catch {
		void 0;
	}
};
