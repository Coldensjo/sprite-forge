import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Upload, Palette, Download, FileJson } from 'lucide-react';

import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from './ui/dialog';

interface ThemeSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const ThemeSettingsDialog = ({ open, onOpenChange }: ThemeSettingsDialogProps) => {
	const { themes, isDark, currentTheme, setThemeByName, toggleDarkMode, exportCurrentTheme, importThemeFromJson } = useTheme();
	const { toast } = useToast();

	const handleExportTheme = () => {
		try {
			const themeJson = exportCurrentTheme();
			const blob = new Blob([themeJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${currentTheme.name}-theme.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast({
				title: 'Theme exported',
				description: `Theme "${currentTheme.displayName}" has been exported successfully.`
			});
		} catch (error) {
			toast({
				variant: 'destructive',
				title: 'Export failed',
				description: 'Failed to export theme.'
			});
		}
	};

	const handleImportTheme = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				importThemeFromJson(text);
				toast({
					title: 'Theme imported',
					description: 'Theme has been imported and applied successfully.'
				});
			} catch (error) {
				toast({
					variant: 'destructive',
					title: 'Import failed',
					description: error instanceof Error ? error.message : 'Invalid theme file format.'
				});
			}
		};
		input.click();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader className="space-y-3 pb-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-primary/10">
							<Palette className="h-5 w-5 text-primary" />
						</div>
						<div>
							<DialogTitle className="text-xl font-semibold">Theme Settings</DialogTitle>
							<DialogDescription className="text-sm mt-1">Customize the appearance of the application</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-6">
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<Label htmlFor="theme-select" className="text-sm font-medium">
								Theme
							</Label>
						</div>
						<Select value={currentTheme.name} onValueChange={setThemeByName}>
							<SelectTrigger className="h-11" id="theme-select">
								<SelectValue placeholder="Select a theme" />
							</SelectTrigger>
							<SelectContent>
								{themes.map((theme) => (
									<SelectItem key={theme.name} value={theme.name}>
										<div className="flex items-center gap-2">
											<div className="flex gap-1">
												<div
													className="w-3 h-3 rounded-full border border-border"
													style={{
														backgroundColor: `hsl(${theme.colors[isDark ? 'dark' : 'light'].primary})`
													}}
												/>
												<div
													className="w-3 h-3 rounded-full border border-border"
													style={{
														backgroundColor: `hsl(${theme.colors[isDark ? 'dark' : 'light'].accent})`
													}}
												/>
											</div>
											<span className="font-medium">{theme.displayName}</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="p-4 rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3 flex-1">
								<div className={cn('p-2 rounded-lg transition-colors', isDark ? 'bg-primary/20' : 'bg-muted')}>
									{isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-foreground" />}
								</div>
								<div className="space-y-0.5 flex-1">
									<Label htmlFor="dark-mode" className="text-sm font-medium cursor-pointer">
										Dark Mode
									</Label>
									<p className="text-xs text-muted-foreground">Toggle between light and dark color variants</p>
								</div>
							</div>
							<Switch id="dark-mode" checked={isDark} className="ml-4" onCheckedChange={toggleDarkMode} />
						</div>
					</div>

					<div className="pt-2 border-t border-border">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<FileJson className="h-4 w-4 text-muted-foreground" />
								<Label className="text-sm font-medium">Theme Management</Label>
							</div>
							<div className="flex gap-3">
								<Button size="default" variant="outline" onClick={handleExportTheme} className="flex-1 h-10 font-medium">
									<Download className="h-4 w-4 mr-2" />
									Export Theme
								</Button>
								<Button size="default" variant="outline" onClick={handleImportTheme} className="flex-1 h-10 font-medium">
									<Upload className="h-4 w-4 mr-2" />
									Import Theme
								</Button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
