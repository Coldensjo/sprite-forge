import { Progress } from './ui/progress';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from './ui/dialog';

interface LoadingDialogProps {
	open: boolean;
	stage?: string;
	total?: number;
	current?: number;
}

export const LoadingDialog = ({ open, stage, current = 0, total = 100 }: LoadingDialogProps) => {
	const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

	return (
		<Dialog open={open}>
			<DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Loading Tibia Files</DialogTitle>
					<DialogDescription>Please wait while we load the client data...</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">{stage || 'Loading...'}</span>
							<span className="font-mono font-medium">{percentage}%</span>
						</div>
						<Progress className="h-2" value={percentage} />
					</div>

					{total > 0 && (
						<div className="text-xs text-muted-foreground text-center font-mono">
							{current.toLocaleString()} / {total.toLocaleString()}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
