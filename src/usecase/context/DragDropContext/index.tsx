import React from 'react';

interface DragDropContextType {
	draggedItem: any;
	isDragging: boolean;
	endDrag: () => void;
	dragType: null | string;
	startDrag: (item: any, type: string, preview?: React.ReactNode) => void;
}

const DragDropContext = React.createContext<undefined | DragDropContextType>(undefined);

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [isDragging, setIsDragging] = React.useState(false);
	const [draggedItem, setDraggedItem] = React.useState<any>(null);
	const [dragType, setDragType] = React.useState<null | string>(null);
	const [previewElement, setPreviewElement] = React.useState<null | React.ReactNode>(null);
	const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
	const mousePosRef = React.useRef({ x: 0, y: 0 });

	// Track mouse position globally to ensure correct start position
	React.useEffect(() => {
		const handleGlobalMouseMove = (e: MouseEvent) => {
			mousePosRef.current = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
		return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
	}, []);

	const startDrag = React.useCallback((item: any, type: string, preview?: React.ReactNode) => {
		setDraggedItem(item);
		setDragType(type);
		setPreviewElement(preview || null);
		setMousePos(mousePosRef.current);
		setIsDragging(true);
	}, []);

	const endDrag = React.useCallback(() => {
		setIsDragging(false);
		setDraggedItem(null);
		setDragType(null);
		setPreviewElement(null);
	}, []);

	const contextValue = React.useMemo(
		() => ({
			endDrag,
			dragType,
			startDrag,
			isDragging,
			draggedItem
		}),
		[isDragging, draggedItem, dragType, startDrag, endDrag]
	);

	React.useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) {
				setMousePos({ x: e.clientX, y: e.clientY });
			}
		};

		const handleMouseUp = () => {
			if (isDragging) {
				endDrag();
			}
		};

		if (isDragging) {
			// Disable text selection globally during drag
			document.body.style.userSelect = 'none';
			document.body.style.webkitUserSelect = 'none';
			document.body.style.cursor = 'grabbing';

			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
		}

		return () => {
			// Re-enable text selection when drag ends
			document.body.style.userSelect = '';
			document.body.style.webkitUserSelect = '';
			document.body.style.cursor = '';

			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isDragging]);

	return (
		<DragDropContext.Provider value={contextValue}>
			{children}
			{isDragging && (
				<div
					style={{
						zIndex: 9999,
						position: 'fixed',
						top: mousePos.y + 15,
						left: mousePos.x + 15,
						pointerEvents: 'none'
					}}
				>
					{previewElement ? (
						previewElement
					) : (
						<div
							style={{
								color: 'white',
								fontSize: '12px',
								padding: '4px 8px',
								borderRadius: '4px',
								backgroundColor: 'rgba(0, 0, 0, 0.8)',
								boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
								border: '1px solid rgba(255, 255, 255, 0.2)'
							}}
						>
							{dragType === 'sprite'
								? `Sprite ${draggedItem}`
								: dragType === 'sprites'
									? `${(draggedItem as any[]).length} Sprites`
									: 'Dragging...'}
						</div>
					)}
				</div>
			)}
		</DragDropContext.Provider>
	);
};

export const useDragDrop = () => {
	const context = React.useContext(DragDropContext);
	if (context === undefined) {
		throw new Error('useDragDrop must be used within a DragDropProvider');
	}
	return context;
};
