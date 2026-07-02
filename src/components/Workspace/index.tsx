import React from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';

import { cn } from '~/lib/utils';
import Resizer from '~/components/Dock/Resizer';
import { DockApi } from '~/usecase/hooks/useDock';
import DockSide from '~/components/Workspace/DockSide';
import FloatingPanel from '~/components/Dock/FloatingPanel';
import {
	PanelId,
	panelMeta,
	floatRectOf,
	zoneFixedHeight,
	DragHandleProps,
	DEFAULT_TOP_HEIGHT,
	DEFAULT_BOTTOM_HEIGHT
} from '~/usecase/util/dock';

interface WorkspaceProps {
	dock: DockApi;
	children: React.ReactNode;
	renderPanel: (id: PanelId, handle?: DragHandleProps) => React.ReactNode;
}

export const Workspace = ({ dock, children, renderPanel }: WorkspaceProps) => {
	const renderFloatingPanel = (id: PanelId) => {
		const rect = floatRectOf(dock.layout, id);
		if (!rect) return null;
		return (
			<FloatingPanel
				id={id}
				key={id}
				rect={rect}
				meta={panelMeta(id)}
				guarded={dock.guard}
				onResizeEnd={() => dock.setResizing(false)}
				onResizeStart={() => dock.setResizing(true)}
				onResize={(side, dx, dy) => dock.resizeFloatPanel(id, side, dx, dy)}
			>
				{(handle) => renderPanel(id, handle)}
			</FloatingPanel>
		);
	};

	return (
		<DndContext
			sensors={dock.sensors}
			onDragEnd={dock.handleDragEnd}
			onDragMove={dock.handleDragMove}
			onDragStart={dock.handleDragStart}
			collisionDetection={pointerWithin}
		>
			<div ref={dock.workspaceRef} className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden p-1.5">
				<DockSide zone="left" dock={dock} renderPanel={renderPanel} />

				{(() => {
					const hasContent = (cols: PanelId[][]) => cols.some((c) => c.some((id) => dock.isRenderable(id)));
					const bottomVisible = hasContent(dock.dragLayout.bottom) || dock.dropTarget?.zone === 'bottom';
					const topVisible = hasContent(dock.dragLayout.top) || dock.dropTarget?.zone === 'top';
					const dragFixed = dock.dragging ? panelMeta(dock.dragging).fixedHeight : undefined;
					const bottomFixed =
						zoneFixedHeight(dock.dragLayout, 'bottom', dock.isRenderable) ??
						(dock.dropTarget?.zone === 'bottom' ? (dragFixed ?? null) : null);
					const topFixed =
						zoneFixedHeight(dock.dragLayout, 'top', dock.isRenderable) ??
						(dock.dropTarget?.zone === 'top' ? (dragFixed ?? null) : null);
					const bottomH = bottomFixed ?? dock.layout.bottomHeight ?? DEFAULT_BOTTOM_HEIGHT;
					const topH = topFixed ?? dock.layout.topHeight ?? DEFAULT_TOP_HEIGHT;
					return (
						<div className="flex min-h-0 min-w-0 flex-1 flex-col">
							<div
								style={{ height: topVisible ? topH : 0 }}
								className={cn(
									'relative flex flex-shrink-0',
									topVisible && 'mb-1.5',
									dock.dragging && 'transition-[height] duration-200 ease-out'
								)}
							>
								<div className="flex h-full w-full overflow-hidden">
									<DockSide zone="top" dock={dock} renderPanel={renderPanel} />
								</div>
								{topVisible && !topFixed && (
									<Resizer
										gap
										dir="y"
										side="bottom"
										onResizeEnd={() => dock.setResizing(false)}
										onResizeStart={() => dock.setResizing(true)}
										onResize={({ dy }) => dock.resizeTopHeight(dy)}
									/>
								)}
							</div>

							<div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>

							<div
								style={{ height: bottomVisible ? bottomH : 0 }}
								className={cn(
									'relative flex flex-shrink-0',
									bottomVisible && 'mt-1.5',
									dock.dragging && 'transition-[height] duration-200 ease-out'
								)}
							>
								{bottomVisible && !bottomFixed && (
									<Resizer
										gap
										dir="y"
										side="top"
										onResizeEnd={() => dock.setResizing(false)}
										onResizeStart={() => dock.setResizing(true)}
										onResize={({ dy }) => dock.resizeBottomHeight(dy)}
									/>
								)}
								<div className="flex h-full w-full overflow-hidden">
									<DockSide dock={dock} zone="bottom" renderPanel={renderPanel} />
								</div>
							</div>
						</div>
					);
				})()}

				<DockSide dock={dock} zone="right" renderPanel={renderPanel} />

				{dock.floating.map(renderFloatingPanel)}
			</div>

			<DragOverlay dropAnimation={null}>
				{dock.dragging ? (
					<div
						style={{ width: dock.dragSize?.width, height: dock.dragSize?.height }}
						className="cursor-grabbing rounded-lg shadow-[0_10px_40px_-5px_rgba(0,0,0,0.65)] ring-1 ring-black/40"
					>
						{renderPanel(dock.dragging)}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
};
