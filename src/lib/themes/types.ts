export interface ThemeColors {
	card: string;
	ring: string;
	muted: string;
	input: string;
	accent: string;
	border: string;
	popover: string;
	primary: string;
	secondary: string;
	background: string;
	foreground: string;
	'panel-bg': string;
	destructive: string;
	'item-hover': string;
	'toolbar-bg': string;
	'panel-border': string;
	'sidebar-ring': string;
	'item-selected': string;
	'sidebar-accent': string;
	'sidebar-border': string;
	'card-foreground': string;
	'sidebar-primary': string;
	'muted-foreground': string;
	'accent-foreground': string;
	'popover-foreground': string;
	'primary-foreground': string;
	'sidebar-background': string;
	'sidebar-foreground': string;
	'secondary-foreground': string;
	'destructive-foreground': string;
	'sidebar-accent-foreground': string;
	'sidebar-primary-foreground': string;
}

export interface Theme {
	name: string;
	displayName: string;
	colors: {
		dark: ThemeColors;
		light: ThemeColors;
	};
}









