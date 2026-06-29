import { useDraggable } from '@dnd-kit/core';

export type DockZone = 'left' | 'right';

export type PanelKind = 'itemList' | 'spriteList' | 'openedItems' | 'recentExports' | 'visualization';

export type PanelId = string;

export type DockColumn = PanelId[];

export type ResizeSide = 'top' | 'left' | 'right' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type UseDraggableReturn = ReturnType<typeof useDraggable>;

export interface DragHandleProps {
	className: string;
	listeners: UseDraggableReturn['listeners'];
	attributes: UseDraggableReturn['attributes'];
	ref: UseDraggableReturn['setActivatorNodeRef'];
}

export interface PanelMeta {
	id: PanelId;
	title: string;
	minWidth: number;
	minHeight: number;
	resizable: boolean;
	stackable: boolean;
}

export interface FloatRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DockLayout {
	left: DockColumn[];
	right: DockColumn[];
	width: Partial<Record<PanelId, number>>;
	height: Partial<Record<PanelId, number>>;
	float: Partial<Record<PanelId, FloatRect>>;
}

export interface DropTarget {
	col: number;
	zone: DockZone;
	row: null | number;
}

export interface Bounds {
	width: number;
	height: number;
}

export const DEFAULT_PANEL_WIDTH = 256;
export const MIN_PANEL_WIDTH = 180;
export const MAX_PANEL_WIDTH = 600;

export const DEFAULT_PANEL_HEIGHT = 200;
export const MIN_PANEL_HEIGHT = 80;

export const DEFAULT_FLOAT_WIDTH = 280;
export const DEFAULT_FLOAT_HEIGHT = 420;

export const DEFAULT_MAX_STACK = 4;

export const PANELS: Record<PanelKind, PanelMeta> = {
	itemList: { minWidth: 200, id: 'itemList', minHeight: 160, resizable: true, stackable: true, title: 'Objects' },
	spriteList: { minWidth: 200, minHeight: 160, resizable: true, stackable: true, id: 'spriteList', title: 'Sprites' },
	openedItems: {
		minHeight: 80,
		resizable: true,
		stackable: true,
		id: 'openedItems',
		title: 'Opened Objects',
		minWidth: MIN_PANEL_WIDTH
	},
	visualization: {
		minHeight: 120,
		resizable: true,
		stackable: true,
		id: 'visualization',
		title: 'Visualization',
		minWidth: MIN_PANEL_WIDTH
	},
	recentExports: {
		minHeight: 100,
		resizable: true,
		stackable: true,
		id: 'recentExports',
		title: 'Exported Objects',
		minWidth: MIN_PANEL_WIDTH
	}
};

const EXTRA_PANELS: Record<string, PanelMeta> = {};

export function registerExtraPanels(metas: { id: string; title: string }[]): void {
	for (const m of metas) {
		EXTRA_PANELS[m.id] = {
			id: m.id,
			title: m.title,
			resizable: true,
			stackable: true,
			minWidth: MIN_PANEL_WIDTH,
			minHeight: MIN_PANEL_HEIGHT
		};
	}
}

const DEFAULT_META = (id: string): PanelMeta => ({
	id,
	title: id,
	resizable: true,
	stackable: true,
	minWidth: MIN_PANEL_WIDTH,
	minHeight: MIN_PANEL_HEIGHT
});

export const isPanelId = (id: unknown): id is PanelId => typeof id === 'string' && (id in PANELS || id in EXTRA_PANELS);

export const panelMeta = (id: PanelId): PanelMeta =>
	(PANELS as Record<string, PanelMeta>)[id] ?? EXTRA_PANELS[id] ?? DEFAULT_META(id);

export const DEFAULT_DOCK_LAYOUT: DockLayout = {
	float: {},
	right: [['spriteList']],
	height: { openedItems: 140, visualization: 170, recentExports: 150 },
	left: [['visualization', 'openedItems', 'recentExports', 'itemList']],
	width: { spriteList: DEFAULT_PANEL_WIDTH, visualization: DEFAULT_PANEL_WIDTH }
};

const PANEL_KINDS = Object.keys(PANELS) as PanelKind[];

const STORAGE_KEY = 'sprite-forge-dock-layout';

export interface DockOpts {
	storageKey?: string;
	knownPanelIds?: string[];
	defaultLayout?: DockLayout;
	autoFillKinds?: PanelKind[];
}

interface ResolvedOpts {
	storageKey: string;
	defaultLayout: DockLayout;
	autoFillKinds: PanelKind[];
	knownPanelIds: null | Set<string>;
}

const resolveOpts = (o?: DockOpts): ResolvedOpts => ({
	storageKey: o?.storageKey ?? STORAGE_KEY,
	autoFillKinds: o?.autoFillKinds ?? PANEL_KINDS,
	defaultLayout: o?.defaultLayout ?? DEFAULT_DOCK_LAYOUT,
	knownPanelIds: o?.knownPanelIds ? new Set(o.knownPanelIds) : null
});

export function placedIds(layout: DockLayout): PanelId[] {
	const ids = new Set<PanelId>();
	for (const zone of ['left', 'right'] as DockZone[]) for (const col of layout[zone]) for (const id of col) ids.add(id);
	for (const id of Object.keys(layout.float)) ids.add(id as PanelId);
	return [...ids];
}

export function defaultDockLayout(opts?: DockOpts): DockLayout {
	const d = resolveOpts(opts).defaultLayout;
	return {
		float: { ...d.float },
		width: { ...d.width },
		height: { ...d.height },
		left: d.left.map((c) => [...c]),
		right: d.right.map((c) => [...c])
	};
}

export function locate(layout: DockLayout, id: PanelId): null | { col: number; row: number; zone: DockZone } {
	for (const zone of ['left', 'right'] as DockZone[]) {
		const cols = layout[zone];
		for (let c = 0; c < cols.length; c++) {
			const r = cols[c].indexOf(id);
			if (r >= 0) return { zone, col: c, row: r };
		}
	}
	return null;
}

export function isFloating(layout: DockLayout, id: PanelId): boolean {
	return !!layout.float[id];
}

export function floatRectOf(layout: DockLayout, id: PanelId): null | FloatRect {
	return layout.float[id] ?? null;
}

export function widthOf(layout: DockLayout, id: PanelId): number {
	return layout.width[id] ?? DEFAULT_PANEL_WIDTH;
}

export function columnWidthOf(layout: DockLayout, zone: DockZone, col: number): number {
	const c = layout[zone][col];
	return c && c.length ? widthOf(layout, c[0]) : DEFAULT_PANEL_WIDTH;
}

export function heightOf(layout: DockLayout, id: PanelId): number {
	return layout.height[id] ?? DEFAULT_PANEL_HEIGHT;
}

export function removePanel(layout: DockLayout, id: PanelId): DockLayout {
	const strip = (cols: DockColumn[]) => cols.map((c) => c.filter((p) => p !== id)).filter((c) => c.length > 0);
	const float = { ...layout.float };
	delete float[id];
	return { float, width: layout.width, height: layout.height, left: strip(layout.left), right: strip(layout.right) };
}

export function canStackInto(column: DockColumn, dragId: PanelId, maxStack: number): boolean {
	if (!panelMeta(dragId).stackable) return false;
	if (column.length >= maxStack) return false;
	return column.every((p) => panelMeta(p).stackable);
}

export function dockAt(layout: DockLayout, id: PanelId, target: DropTarget, maxStack: number): DockLayout {
	const base = removePanel(layout, id);
	const cols = base[target.zone].map((c) => [...c]);
	let width = base.width;

	const insertColumn = (at: number) => cols.splice(Math.max(0, Math.min(at, cols.length)), 0, [id]);

	if (target.row === null || cols.length === 0) {
		insertColumn(target.col);
	} else {
		const ci = Math.max(0, Math.min(target.col, cols.length - 1));
		const column = cols[ci];
		if (!canStackInto(column, id, maxStack)) {
			insertColumn(ci + 1);
		} else {
			const at = Math.max(0, Math.min(target.row, column.length));
			if (at === 0 && column.length > 0) width = { ...width, [id]: widthOf(layout, column[0]) };
			column.splice(at, 0, id);
		}
	}

	return { ...base, width, [target.zone]: cols };
}

export function floatAt(layout: DockLayout, id: PanelId, rect: FloatRect): DockLayout {
	const base = removePanel(layout, id);
	return { ...base, float: { ...base.float, [id]: rect } };
}

export function resizeColumn(layout: DockLayout, zone: DockZone, col: number, width: number): DockLayout {
	const c = layout[zone][col];
	if (!c || !c.length) return layout;
	const min = Math.max(MIN_PANEL_WIDTH, ...c.map((id) => panelMeta(id).minWidth));
	const clamped = Math.max(min, Math.min(width, MAX_PANEL_WIDTH));
	return { ...layout, width: { ...layout.width, [c[0]]: clamped } };
}

export function resizeHeight(layout: DockLayout, id: PanelId, height: number): DockLayout {
	const clamped = Math.max(panelMeta(id).minHeight || MIN_PANEL_HEIGHT, height);
	return { ...layout, height: { ...layout.height, [id]: clamped } };
}

export function resizeFloat(
	layout: DockLayout,
	id: PanelId,
	side: ResizeSide,
	dx: number,
	dy: number,
	bounds?: Bounds
): DockLayout {
	const rect = layout.float[id];
	if (!rect || !panelMeta(id).resizable) return layout;

	const minW = Math.max(MIN_PANEL_WIDTH, panelMeta(id).minWidth);
	const minH = Math.max(MIN_PANEL_HEIGHT, panelMeta(id).minHeight);

	let left = rect.x;
	let top = rect.y;
	let right = rect.x + rect.width;
	let bottom = rect.y + rect.height;

	if (side.includes('left')) left += dx;
	if (side.includes('right')) right += dx;
	if (side.includes('top')) top += dy;
	if (side.includes('bottom')) bottom += dy;

	if (right - left < minW) {
		if (side.includes('left')) left = right - minW;
		else right = left + minW;
	}
	if (bottom - top < minH) {
		if (side.includes('top')) top = bottom - minH;
		else bottom = top + minH;
	}

	left = Math.max(0, left);
	top = Math.max(0, top);
	if (bounds) {
		right = Math.min(bounds.width, right);
		bottom = Math.min(bounds.height, bottom);
	}

	const next: FloatRect = { y: top, x: left, width: Math.max(minW, right - left), height: Math.max(minH, bottom - top) };
	return { ...layout, float: { ...layout.float, [id]: next } };
}

export function clampFloatsToBounds(layout: DockLayout, bounds: Bounds): DockLayout {
	let changed = false;
	const float: DockLayout['float'] = {};
	for (const id of Object.keys(layout.float) as PanelId[]) {
		const rect = layout.float[id];
		if (!rect) continue;
		const width = Math.min(rect.width, bounds.width);
		const height = Math.min(rect.height, bounds.height);
		const x = Math.max(0, Math.min(rect.x, bounds.width - width));
		const y = Math.max(0, Math.min(rect.y, bounds.height - height));
		if (x !== rect.x || y !== rect.y || width !== rect.width || height !== rect.height) changed = true;
		float[id] = { x, y, width, height };
	}
	return changed ? { ...layout, float } : layout;
}

function isValidRect(value: unknown): value is FloatRect {
	if (!value || typeof value !== 'object') return false;
	const r = value as Record<string, unknown>;
	return (['x', 'y', 'width', 'height'] as const).every((k) => typeof r[k] === 'number');
}

function parseColumns(arr: unknown): DockColumn[] {
	if (!Array.isArray(arr)) return [];
	const cols: DockColumn[] = [];
	const ok = (id: unknown): id is string => typeof id === 'string' && id.length > 0;
	for (const entry of arr) {
		if (Array.isArray(entry)) {
			const col = entry.filter(ok);
			if (col.length) cols.push(col);
		} else if (ok(entry)) {
			cols.push([entry]);
		}
	}
	return cols;
}

function parseDockLayout(parsed: null | Partial<DockLayout>, opts?: DockOpts): DockLayout {
	const r = resolveOpts(opts);
	if (!parsed || typeof parsed !== 'object') return defaultDockLayout(opts);

	const allow = (id: string) => !r.knownPanelIds || r.knownPanelIds.has(id);
	const seen = new Set<PanelId>();
	const dedup = (cols: DockColumn[]) =>
		cols.map((c) => c.filter((id) => (seen.has(id) || !allow(id) ? false : (seen.add(id), true)))).filter((c) => c.length > 0);
	const left = dedup(parseColumns(parsed.left));
	const right = dedup(parseColumns(parsed.right));

	const float: DockLayout['float'] = {};
	if (parsed.float && typeof parsed.float === 'object') {
		for (const [id, rect] of Object.entries(parsed.float as Record<string, unknown>)) {
			if (typeof id === 'string' && !seen.has(id) && allow(id) && isValidRect(rect)) {
				float[id] = rect;
				seen.add(id);
			}
		}
	}

	const width: DockLayout['width'] = {};
	if (parsed.width && typeof parsed.width === 'object') {
		for (const [id, w] of Object.entries(parsed.width as Record<string, unknown>)) {
			if (typeof id === 'string' && typeof w === 'number') width[id] = w;
		}
	}

	const height: DockLayout['height'] = {};
	if (parsed.height && typeof parsed.height === 'object') {
		for (const [id, h] of Object.entries(parsed.height as Record<string, unknown>)) {
			if (typeof id === 'string' && typeof h === 'number') height[id] = h;
		}
	}

	for (const zone of ['left', 'right'] as DockZone[]) {
		for (const col of r.defaultLayout[zone]) {
			const missing = col.filter((id) => !seen.has(id) && allow(id));
			if (missing.length === 0) continue;
			(zone === 'left' ? left : right).push(missing);
			for (const id of missing) seen.add(id);
		}
	}

	for (const id of r.autoFillKinds) {
		if (seen.has(id)) continue;
		(r.defaultLayout.left.some((c) => c.includes(id)) ? left : right).push([id]);
		seen.add(id);
	}

	return { left, right, float, width, height };
}

export function loadDockLayout(opts?: DockOpts): DockLayout {
	const r = resolveOpts(opts);
	try {
		return parseDockLayout(JSON.parse(localStorage.getItem(r.storageKey) || 'null'), opts);
	} catch {
		return defaultDockLayout(opts);
	}
}

export function saveDockLayout(layout: DockLayout, opts?: DockOpts): void {
	const r = resolveOpts(opts);
	try {
		localStorage.setItem(r.storageKey, JSON.stringify(layout));
	} catch {
		void 0;
	}
}
