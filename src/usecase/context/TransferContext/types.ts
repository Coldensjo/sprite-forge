import type { ImportSource, ThingCategory } from '~/lib/formats/tibia';

export interface ImportPreset {
	paths: string[];
	replaceId?: number;
	source: ImportSource;
	replaceCategory?: ThingCategory;
}

export interface TransferContextValue {
	importOpen: boolean;
	closeExport: () => void;
	closeImport: () => void;
	exportIds: null | number[];
	importPreset: null | ImportPreset;
	openExport: (ids: number[]) => void;
	openImport: (preset?: ImportPreset) => void;
}
