import { cn } from '~/lib/utils';
import { VNode } from '~/adapter/forge';
import { DragHandleProps } from '~/usecase/util/dock';
import { LuaCtx, renderNode } from '~/usecase/lua/render';

interface LuaDockPanelProps {
	tree: VNode;
	title: string;
	dragHandle?: DragHandleProps;
	dispatch: (cbId: number, arg?: unknown) => void;
}

export const LuaDockPanel = ({ tree, title, dispatch, dragHandle }: LuaDockPanelProps) => {
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};

	return (
		<div className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden rounded-lg bg-card shadow-island">
			<div
				{...handleProps}
				className={cn(
					'flex h-8 flex-shrink-0 items-center border-b border-border/50 bg-secondary/80 px-3',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h2>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				<LuaCtx.Provider value={{ dispatch }}>{renderNode(tree, 'root')}</LuaCtx.Provider>
			</div>
		</div>
	);
};
