import { cn } from '~/lib/utils';
import { SlicerPanelProps } from '~/components/SlicerWindow/types';

export const SlicerPanel = ({ title, children, dragHandle, headerExtra }: SlicerPanelProps) => {
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};
	return (
		<div className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden rounded-lg bg-card shadow-island">
			<div
				{...handleProps}
				className={cn(
					'flex h-7 flex-shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-secondary/80 px-2',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">{title}</span>
				{headerExtra}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
		</div>
	);
};
