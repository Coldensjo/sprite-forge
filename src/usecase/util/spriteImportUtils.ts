import type { AssetData, ThingType } from '~/lib/formats/tibia/types';
import type { ConfirmContextValue } from '~/usecase/context/ConfirmContext/types';

import { thingSpritesAreShared } from '~/lib/formats/tibia';

interface SpriteReplaceMode {
	allocateNewSprites: boolean;
}

export async function confirmSpriteReplace(
	thing: ThingType,
	data: AssetData,
	confirmDialog: ConfirmContextValue['confirm'],
	opts?: { confirmWhenUnshared?: boolean }
): Promise<null | SpriteReplaceMode> {
	if (thingSpritesAreShared(thing, data)) {
		const choice = await confirmDialog({
			variant: 'warning',
			confirmLabel: 'Replace',
			alternateLabel: 'Add as new',
			title: `Replace sprites for ${thing.category} #${thing.id}?`,
			description:
				'Other objects share these sprites. Replacing will update them too. Choose "Add as new" to import without affecting other objects.'
		});
		if (!choice) return null;
		return { allocateNewSprites: choice === 'alternate' };
	}

	if (opts?.confirmWhenUnshared) {
		const ok = await confirmDialog({
			variant: 'warning',
			confirmLabel: 'Replace',
			title: `Replace ${thing.category} #${thing.id}?`,
			description: 'The selected image will overwrite this object.'
		});
		if (!ok) return null;
	}

	return { allocateNewSprites: false };
}
