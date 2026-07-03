export type ConfirmResult = boolean | 'alternate';

export interface ConfirmOptions {
	title: string;
	cancelLabel?: string;
	description?: string;
	confirmLabel?: string;
	alternateLabel?: string;
	variant?: 'default' | 'warning' | 'destructive';
}

export interface ConfirmContextValue {
	confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
}
