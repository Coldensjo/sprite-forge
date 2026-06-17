import { invoke } from '@tauri-apps/api/core';
import { logger, EventCode } from '@/lib/debug';
import { save } from '@tauri-apps/plugin-dialog';

import { AssetData, ThingType } from './types';

export async function exportObjectSheet(thing: ThingType, data: AssetData) {
	if (!data || !data.sprPath) {
		logger.log(EventCode.ERROR, { msg: 'Cannot export object sheet: Data not loaded' });
		return;
	}

	try {
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
