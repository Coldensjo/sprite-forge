import type { OutfitData } from '@/usecase/context/PropertiesContext/types';

export interface SceneItem {
	id: number;
	count?: number;
}

export interface SceneTile {
	items: SceneItem[];
}

export interface ItemPropertiesState {
	zoom: number;
	panX: number;
	panY: number;
	patternX: number;
	patternY: number;
	patternZ: number;
	showGrid: boolean;
	isPlaying: boolean;
	currentFrame: number;
	currentLayer: number;
	showExactSize: boolean;
	outfitData: OutfitData;
}
