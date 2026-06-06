import type { PropertiesContextValue } from './types';

import React from 'react';

export const PropertiesContext = React.createContext<null | PropertiesContextValue>(null);

export const usePropertiesContext = (): PropertiesContextValue => {
	const ctx = React.useContext(PropertiesContext);
	if (!ctx) {
		throw new Error('usePropertiesContext must be used within a PropertiesContext provider');
	}
	return ctx;
};
