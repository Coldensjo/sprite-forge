import { invoke } from '@tauri-apps/api/core';
import { logger, EventCode } from '@/lib/debug';
import { save } from '@tauri-apps/plugin-dialog';

import { TibiaData, ThingType } from './types';

/**
 * Export object sprite sheet using Rust backend
 * This ensures high performance for large sheets and correct sprite composition
 */
export async function exportObjectSheet(thing: ThingType, data: TibiaData) {
	if (!data || !data.sprPath) {
		logger.log(EventCode.ERROR, { msg: 'Cannot export object sheet: Data not loaded' });
		return;
	}

	try {
		// 1. Prompt user for save location
		const filePath = await save({
			defaultPath: `${thing.category}_${thing.id}.png`,
			filters: [
				{
					name: 'Image',
					extensions: ['png']
				}
			]
		});

		if (!filePath) return;

		// 2. Offload generation to Rust
		// Rust handles loading sprites, compositing, and saving the PNG
		await invoke('export_object_sheet_rust', {
			thing,
			path: filePath,
			sprPath: data.sprPath,
			transparent: data.transparency
		});

		logger.log(EventCode.CANVAS_DRAW, { path: filePath, msg: 'Export successful' });
	} catch (err) {
		logger.log(EventCode.ERROR, { err, msg: 'Failed to export object sheet' });
		console.error('Export failed:', err);
	}
}
