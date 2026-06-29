import React from 'react';

import { LayerViewProps } from '~/components/SlicerWindow/types';

export const LayerView = ({ zoom, layer, cursor, onMouseDown, pointerEvents }: LayerViewProps) => {
	const ref = React.useRef<HTMLCanvasElement>(null);
	React.useEffect(() => {
		const c = ref.current;
		if (!c) return;
		c.width = layer.canvas.width;
		c.height = layer.canvas.height;
		const ctx = c.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.drawImage(layer.canvas, 0, 0);
	}, [layer.canvas]);
	return (
		<canvas
			ref={ref}
			onMouseDown={onMouseDown}
			style={{
				cursor,
				pointerEvents,
				top: layer.y * zoom,
				position: 'absolute',
				left: layer.x * zoom,
				imageRendering: 'pixelated',
				width: layer.canvas.width * zoom,
				height: layer.canvas.height * zoom
			}}
		/>
	);
};
