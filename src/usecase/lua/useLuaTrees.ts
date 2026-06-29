import React from 'react';

import { VNode, forgePanels, forgeDispatch } from '~/adapter/forge';

export const useLuaTrees = () => {
	const [trees, setTrees] = React.useState<Map<string, VNode>>(new Map());

	const refresh = React.useCallback(async () => {
		try {
			const ps = await forgePanels();
			setTrees(new Map(ps.map((p) => [p.id, p.tree])));
		} catch (e) {
			console.error('forge_panels failed', e);
		}
	}, []);

	React.useEffect(() => {
		refresh();
	}, [refresh]);

	const dispatch = React.useCallback(
		async (cbId: number, arg?: unknown) => {
			try {
				await forgeDispatch(cbId, arg);
			} catch (e) {
				console.error('forge_dispatch failed', e);
			}
			await refresh();
		},
		[refresh]
	);

	return { trees, refresh, dispatch };
};
