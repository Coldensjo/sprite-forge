export interface ConfirmOptions {
	title: string;
	cancelLabel?: string;
	description?: string;
	confirmLabel?: string;
	variant?: 'default' | 'warning' | 'destructive';
}

export interface ConfirmContextValue {
	confirm: (opts: ConfirmOptions) => Promise<boolean>;
}
