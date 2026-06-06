import type { PropertiesContextValue } from './types';

import { useContext, createContext } from 'react';

export const PropertiesContext = createContext<null | PropertiesContextValue>(null);

export const usePropertiesContext = (): PropertiesContextValue => {
	const ctx = useContext(PropertiesContext);
	if (!ctx) {
		throw new Error('usePropertiesContext must be used within a PropertiesContext provider');
	}
	return ctx;
};
