import { DragHandleProps } from '~/usecase/util/dock';
import { Layer } from '~/usecase/hooks/useSpriteSlicer';

export type SelectOp = 'add' | 'replace' | 'subtract' | 'intersect';

export type DragMode = 'panView' | 'panImage' | 'moveMask' | 'createSel';

export interface SlicerPanelProps {
	title: string;
	children: React.ReactNode;
	dragHandle?: DragHandleProps;
	headerExtra?: React.ReactNode;
}

export interface LayerViewProps {
	layer: Layer;
	zoom: number;
	cursor: string;
	pointerEvents: 'auto' | 'none';
	onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}
