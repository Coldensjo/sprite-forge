import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface DragDropContextType {
    isDragging: boolean;
    draggedItem: any;
    dragType: string | null;
    startDrag: (item: any, type: string, preview?: React.ReactNode) => void;
    endDrag: () => void;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState<any>(null);
    const [dragType, setDragType] = useState<string | null>(null);
    const [previewElement, setPreviewElement] = useState<React.ReactNode | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 });

    // Track mouse position globally to ensure correct start position
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, []);

    const startDrag = useCallback((item: any, type: string, preview?: React.ReactNode) => {
        setDraggedItem(item);
        setDragType(type);
        setPreviewElement(preview || null);
        setMousePos(mousePosRef.current);
        setIsDragging(true);
    }, []);

    const endDrag = useCallback(() => {
        setIsDragging(false);
        setDraggedItem(null);
        setDragType(null);
        setPreviewElement(null);
    }, []);

    const contextValue = useMemo(() => ({
        isDragging,
        draggedItem,
        dragType,
        startDrag,
        endDrag
    }), [isDragging, draggedItem, dragType, startDrag, endDrag]);

    useEffect(() => {
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
                        position: 'fixed',
                        left: mousePos.x + 15,
                        top: mousePos.y + 15,
                        pointerEvents: 'none',
                        zIndex: 9999,
                    }}
                >
                    {previewElement ? (
                        previewElement
                    ) : (
                        <div
                            style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            {dragType === 'sprite' ? `Sprite ${draggedItem}` : dragType === 'sprites' ? `${(draggedItem as any[]).length} Sprites` : 'Dragging...'}
                        </div>
                    )}
                </div>
            )}
        </DragDropContext.Provider>
    );
};

export const useDragDrop = () => {
    const context = useContext(DragDropContext);
    if (context === undefined) {
        throw new Error('useDragDrop must be used within a DragDropProvider');
    }
    return context;
};
