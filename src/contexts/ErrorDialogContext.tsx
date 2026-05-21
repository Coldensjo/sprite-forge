import { errorToString } from '@/lib/errorMessage';
import { ErrorDialog, type ErrorInfo } from '@/components/ErrorDialog';
import { useState, useContext, useCallback, createContext, type ReactNode } from 'react';

interface ErrorDialogContextValue {
	showError: (title: string, error: unknown) => void;
}

const ErrorDialogContext = createContext<null | ErrorDialogContextValue>(null);

export const ErrorDialogProvider = ({ children }: { children: ReactNode }) => {
	const [info, setInfo] = useState<null | ErrorInfo>(null);

	const showError = useCallback((title: string, error: unknown) => {
		setInfo({ title, message: errorToString(error) });
	}, []);

	return (
		<ErrorDialogContext.Provider value={{ showError }}>
			{children}
			<ErrorDialog info={info} onClose={() => setInfo(null)} />
		</ErrorDialogContext.Provider>
	);
};

export const useErrorDialog = (): ErrorDialogContextValue => {
	const ctx = useContext(ErrorDialogContext);
	if (!ctx) throw new Error('useErrorDialog must be used within an ErrorDialogProvider');
	return ctx;
};
