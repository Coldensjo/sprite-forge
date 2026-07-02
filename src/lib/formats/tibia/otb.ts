import type { ThingType, AssetData } from './types';

import { invoke } from '@tauri-apps/api/core';

export const SERVER_ITEM_TYPE = {
	None: 0,
	Ground: 1,
	Fluid: 12,
	Splash: 11,
	Container: 2,
	Deprecated: 14
} as const;

export const TILE_STACK_ORDER = {
	Top: 3,
	None: 0,
	Border: 1,
	Bottom: 2
} as const;

export interface XmlAttr {
	key: string;
	value: string;
	tag?: boolean;
	hasValue?: boolean;
	children?: XmlAttr[];
	extra?: [string, string][];
}

export interface ServerItem {
	type: number;
	name: string;
	tradeAs: number;

	plural?: string;
	serverId: number;
	clientId: number;
	movable: boolean;
	nameXml?: string;
	article?: string;
	multiUse: boolean;
	readable: boolean;
	hangable: boolean;
	hookEast: boolean;
	forceUse: boolean;
	stackable: boolean;
	rotatable: boolean;
	hookSouth: boolean;
	lightLevel: number;
	lightColor: number;
	stackOrder: number;
	unpassable: boolean;
	pickupable: boolean;
	ignoreLook: boolean;
	fullGround: boolean;
	groundSpeed: number;
	canNotDecay: boolean;
	isAnimation: boolean;
	minimapColor: number;
	maxReadChars: number;

	spriteHash: number[];
	hasElevation: boolean;
	blockMissiles: boolean;
	hasStackOrder: boolean;
	clientCharges: boolean;
	blockPathfinder: boolean;
	floorChangeDown: boolean;
	floorChangeEast: boolean;
	floorChangeWest: boolean;
	floorChangeNorth: boolean;

	floorChangeSouth: boolean;
	maxReadWriteChars: number;
	xmlAttributes?: XmlAttr[];
	allowDistanceRead: boolean;
}

interface OtbFileRaw {
	buildNumber: number;
	items: ServerItem[];
	majorVersion: number;
	minorVersion: number;
}

export interface OtbMeta {
	buildNumber: number;
	majorVersion: number;
	minorVersion: number;
}

export interface ServerItemData {
	meta: OtbMeta;
	xmlRaw?: string;
	otbPath: string;
	xmlPath?: string;
	profileId: string;
	xmlExisted: boolean;
	items: Map<number, ServerItem>;
	byClientId: Map<number, number[]>;
	xmlOrphans?: Map<number, ItemsXmlEntry>;
	xmlOriginal?: Map<number, ItemsXmlEntry>;
}

const PROFILE_IDS = ['tfs0.3.6', 'tfs0.4', 'tfs0.5', 'tfs1.0', 'tfs1.1', 'tfs1.2', 'tfs1.4', 'tfs1.6'];
const PROFILE_MARKER = /<!--\s*sprite-forge:\s*profile=([\w.]+)\s*-->/;

export function deduceProfileId(minorVersion: number): string {
	const v = minorVersion;
	if (v >= 1100) return 'tfs1.6';
	if (v >= 1090) return 'tfs1.2';
	if (v >= 1031) return 'tfs1.1';
	if (v >= 1000) return 'tfs1.0';
	if (v >= 800) return 'tfs0.4';
	return 'tfs0.3.6';
}

function profileCacheKey(otbPath: string): string {
	return `sprite-forge-otb-profile:${otbPath}`;
}

export function loadCachedProfile(otbPath: string): null | string {
	try {
		if (typeof window === 'undefined') return null;
		const v = localStorage.getItem(profileCacheKey(otbPath));
		return v && PROFILE_IDS.includes(v) ? v : null;
	} catch {
		return null;
	}
}

export function saveCachedProfile(otbPath: string, profileId: string): void {
	try {
		if (typeof window !== 'undefined') localStorage.setItem(profileCacheKey(otbPath), profileId);
	} catch {
		void 0;
	}
}

interface ItemsXmlEntry {
	plural?: string;
	nameXml?: string;
	article?: string;
	attributes: XmlAttr[];
}

function decodeOtbResponse(buf: Uint8Array): OtbFileRaw {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	let o = 0;
	const majorVersion = view.getUint32(o, true);
	o += 4;
	const minorVersion = view.getUint32(o, true);
	o += 4;
	const buildNumber = view.getUint32(o, true);
	o += 4;
	const count = view.getUint32(o, true);
	o += 4;

	const decoder = new TextDecoder();
	const items: ServerItem[] = new Array(count);
	for (let i = 0; i < count; i++) {
		const serverId = view.getUint16(o, true);
		o += 2;
		const clientId = view.getUint16(o, true);
		o += 2;
		const group = buf[o];
		o += 1;
		const flags = view.getUint32(o, true);
		o += 4;
		const groundSpeed = view.getUint16(o, true);
		o += 2;
		const lightLevel = view.getUint16(o, true);
		o += 2;
		const lightColor = view.getUint16(o, true);
		o += 2;
		const minimapColor = view.getUint16(o, true);
		o += 2;
		const maxReadChars = view.getUint16(o, true);
		o += 2;
		const maxReadWriteChars = view.getUint16(o, true);
		o += 2;
		const tradeAs = view.getUint16(o, true);
		o += 2;
		const stackOrder = buf[o];
		o += 1;
		const hashLen = buf[o];
		o += 1;
		const spriteHash = Array.from(buf.subarray(o, o + hashLen));
		o += hashLen;
		const nameLen = view.getUint16(o, true);
		o += 2;
		const name = nameLen ? decoder.decode(buf.subarray(o, o + nameLen)) : '';
		o += nameLen;

		items[i] = {
			name,
			tradeAs,
			serverId,
			clientId,
			lightLevel,
			lightColor,
			stackOrder,
			spriteHash,
			type: group,
			groundSpeed,
			minimapColor,
			maxReadChars,
			maxReadWriteChars,
			movable: !!(flags & (1 << 6)),
			multiUse: !!(flags & (1 << 4)),
			stackable: !!(flags & (1 << 7)),
			readable: !!(flags & (1 << 14)),
			hangable: !!(flags & (1 << 16)),
			hookEast: !!(flags & (1 << 18)),
			forceUse: !!(flags & (1 << 26)),
			unpassable: !!(flags & (1 << 0)),
			pickupable: !!(flags & (1 << 5)),
			rotatable: !!(flags & (1 << 15)),
			hookSouth: !!(flags & (1 << 17)),
			ignoreLook: !!(flags & (1 << 23)),
			fullGround: !!(flags & (1 << 25)),
			hasElevation: !!(flags & (1 << 3)),
			canNotDecay: !!(flags & (1 << 19)),
			isAnimation: !!(flags & (1 << 24)),
			blockMissiles: !!(flags & (1 << 1)),
			hasStackOrder: !!(flags & (1 << 13)),
			clientCharges: !!(flags & (1 << 22)),
			blockPathfinder: !!(flags & (1 << 2)),
			floorChangeDown: !!(flags & (1 << 8)),
			floorChangeNorth: !!(flags & (1 << 9)),
			floorChangeEast: !!(flags & (1 << 10)),
			floorChangeWest: !!(flags & (1 << 12)),
			floorChangeSouth: !!(flags & (1 << 11)),
			allowDistanceRead: !!(flags & (1 << 20))
		};
	}

	return { items, buildNumber, majorVersion, minorVersion };
}

export async function readOtbRaw(path: string): Promise<OtbFileRaw> {
	const response = await invoke<Uint8Array | ArrayBuffer>('read_otb_file', { path });
	const buf = response instanceof Uint8Array ? response : new Uint8Array(response);
	return decodeOtbResponse(buf);
}

export async function writeOtbFile(path: string, meta: OtbMeta, items: ServerItem[]): Promise<void> {
	const sorted = [...items].sort((a, b) => a.serverId - b.serverId);
	await invoke('write_otb_file', {
		path,
		data: {
			items: sorted,
			buildNumber: meta.buildNumber,
			majorVersion: meta.majorVersion,
			minorVersion: meta.minorVersion
		}
	});
}

function parseAttributeElements(parent: Element): XmlAttr[] {
	const out: XmlAttr[] = [];
	for (const child of Array.from(parent.children)) {
		if (child.tagName !== 'attribute') continue;
		const key = child.getAttribute('key') ?? '';
		const value = child.getAttribute('value') ?? '';
		const attr: XmlAttr = { key, value };
		if (!child.hasAttribute('value')) attr.hasValue = false;
		const extra: [string, string][] = [];
		for (const a of Array.from(child.attributes)) {
			if (a.name === 'key' || a.name === 'value') continue;
			extra.push([a.name, a.value]);
		}
		if (extra.length > 0) attr.extra = extra;
		const nested = parseAttributeElements(child);
		if (nested.length > 0) attr.children = nested;
		out.push(attr);
	}
	return out;
}

const RESERVED_TAG_ATTRS = new Set(['id', 'fromid', 'toid', 'name', 'article', 'plural']);

export function parseItemsXml(text: string): Map<number, ItemsXmlEntry> {
	const result = new Map<number, ItemsXmlEntry>();
	const doc = new DOMParser().parseFromString(text, 'application/xml');
	if (doc.querySelector('parsererror')) {
		throw new Error('items.xml is not valid XML');
	}

	const buildEntry = (el: Element): ItemsXmlEntry => {
		const tagAttrs: XmlAttr[] = [];
		for (const attr of Array.from(el.attributes)) {
			if (RESERVED_TAG_ATTRS.has(attr.name)) continue;
			tagAttrs.push({ tag: true, key: attr.name, value: attr.value });
		}
		return {
			nameXml: el.getAttribute('name') ?? undefined,
			plural: el.getAttribute('plural') ?? undefined,
			article: el.getAttribute('article') ?? undefined,
			attributes: [...tagAttrs, ...parseAttributeElements(el)]
		};
	};

	for (const el of Array.from(doc.querySelectorAll('items > item, item'))) {
		const idAttr = el.getAttribute('id');
		const fromId = el.getAttribute('fromid');
		const toId = el.getAttribute('toid');

		if (idAttr != null) {
			const id = parseInt(idAttr, 10);
			if (!Number.isNaN(id)) result.set(id, buildEntry(el));
		} else if (fromId != null && toId != null) {
			const from = parseInt(fromId, 10);
			const to = parseInt(toId, 10);
			if (!Number.isNaN(from) && !Number.isNaN(to) && to - from < 100000) {
				for (let id = from; id <= to; id++) result.set(id, buildEntry(el));
			}
		}
	}

	return result;
}

export function buildServerItems(
	otb: OtbFileRaw,
	xml: null | Map<number, ItemsXmlEntry>,
	otbPath: string,
	xmlPath: string,
	xmlExisted: boolean,
	profileId: string,
	xmlRaw?: string
): ServerItemData {
	const items = new Map<number, ServerItem>();
	const byClientId = new Map<number, number[]>();

	for (const raw of otb.items) {
		const item: ServerItem = { ...raw };
		const x = xml?.get(raw.serverId);
		if (x) {
			item.nameXml = x.nameXml;
			item.article = x.article;
			item.plural = x.plural;
			item.xmlAttributes = x.attributes.length > 0 ? x.attributes : undefined;
		}
		items.set(item.serverId, item);

		const list = byClientId.get(item.clientId);
		if (list) list.push(item.serverId);
		else byClientId.set(item.clientId, [item.serverId]);
	}

	let xmlOrphans: undefined | Map<number, ItemsXmlEntry>;
	if (xml) {
		for (const [id, entry] of xml) {
			if (items.has(id)) continue;
			if (!xmlOrphans) xmlOrphans = new Map();
			xmlOrphans.set(id, entry);
		}
	}

	return {
		items,
		xmlRaw,
		otbPath,
		xmlPath,
		profileId,
		xmlExisted,
		byClientId,
		xmlOrphans,
		xmlOriginal: xml ?? undefined,
		meta: {
			buildNumber: otb.buildNumber,
			majorVersion: otb.majorVersion,
			minorVersion: otb.minorVersion
		}
	};
}

function deriveXmlPath(otbPath: string): string {
	const sep = otbPath.includes('\\') ? '\\' : '/';
	const dir = otbPath.slice(0, otbPath.lastIndexOf(sep) + 1);
	return `${dir}items.xml`;
}

export async function loadServerItems(otbPath: string, xmlPath?: string): Promise<ServerItemData> {
	const otb = await readOtbRaw(otbPath);
	let xml: null | Map<number, ItemsXmlEntry> = null;
	let xmlRaw: string | undefined;
	let markerProfile: null | string = null;
	const xmlExisted = !!xmlPath;
	if (xmlPath) {
		try {
			const text = await invoke<string>('read_file_text', { path: xmlPath });
			xml = parseItemsXml(text);
			xmlRaw = text;
			const m = text.match(PROFILE_MARKER);
			if (m && PROFILE_IDS.includes(m[1])) markerProfile = m[1];
		} catch (err) {
			console.error('Failed to read items.xml:', err);
		}
	}
	const writeXmlPath = xmlPath ?? deriveXmlPath(otbPath);
	const profileId = markerProfile ?? loadCachedProfile(otbPath) ?? deduceProfileId(otb.minorVersion);
	return buildServerItems(otb, xml, otbPath, writeXmlPath, xmlExisted, profileId, xmlRaw);
}

export function createServerItem(serverId: number, clientId: number): ServerItem {
	return {
		serverId,
		clientId,
		name: '',
		tradeAs: 0,
		lightLevel: 0,
		lightColor: 0,
		movable: false,
		groundSpeed: 0,
		spriteHash: [],
		multiUse: false,
		readable: false,
		hangable: false,
		hookEast: false,
		forceUse: false,
		minimapColor: 0,
		maxReadChars: 0,
		stackable: false,
		rotatable: false,
		hookSouth: false,
		unpassable: false,
		pickupable: false,
		ignoreLook: false,
		fullGround: false,
		canNotDecay: false,
		isAnimation: false,
		hasElevation: false,
		blockMissiles: false,
		hasStackOrder: false,
		clientCharges: false,
		maxReadWriteChars: 0,
		blockPathfinder: false,
		floorChangeDown: false,
		floorChangeEast: false,
		floorChangeWest: false,
		floorChangeNorth: false,
		floorChangeSouth: false,
		allowDistanceRead: false,
		type: SERVER_ITEM_TYPE.None,
		stackOrder: TILE_STACK_ORDER.None
	};
}

function thingType(thing: ThingType): number {
	if (thing.isGround) return SERVER_ITEM_TYPE.Ground;
	if (thing.isContainer) return SERVER_ITEM_TYPE.Container;
	if (thing.isFluidContainer) return SERVER_ITEM_TYPE.Fluid;
	if (thing.isFluid) return SERVER_ITEM_TYPE.Splash;
	return SERVER_ITEM_TYPE.None;
}

export function syncFromThingType(server: ServerItem, thing: ThingType, syncType: boolean, clientVersion: number): void {
	if (syncType) {
		server.type = thingType(thing);
	}

	server.unpassable = thing.isUnpassable;
	server.blockMissiles = thing.blockMissile;
	server.blockPathfinder = thing.blockPathfind;
	server.hasElevation = thing.hasElevation;
	server.multiUse = thing.multiUse;
	server.pickupable = thing.pickupable;
	server.movable = !thing.isUnmoveable;
	server.stackable = thing.stackable;
	server.readable = thing.writable || thing.writableOnce || (thing.isLensHelp && thing.lensHelp === 1112);
	server.rotatable = thing.rotatable;
	server.hangable = thing.hangable;
	server.hookSouth = thing.isVertical;
	server.hookEast = thing.isHorizontal;
	server.ignoreLook = thing.ignoreLook;
	server.allowDistanceRead = false;

	if (clientVersion >= 1010) {
		server.forceUse = thing.forceUse;
		server.fullGround = thing.isFullGround;
	} else {
		server.forceUse = false;
		server.fullGround = false;
	}

	server.clientCharges = false;
	server.isAnimation = thing.frames > 1;

	server.lightLevel = thing.lightLevel;
	server.lightColor = thing.lightColor;

	if (thing.isGround) {
		server.groundSpeed = thing.groundSpeed;
	}

	server.minimapColor = thing.miniMapColor;
	server.maxReadWriteChars = thing.writable ? thing.maxTextLength : 0;
	server.maxReadChars = thing.writableOnce ? thing.maxTextLength : 0;

	if (thing.isGroundBorder) {
		server.stackOrder = TILE_STACK_ORDER.Border;
		server.hasStackOrder = true;
	} else if (thing.isOnBottom) {
		server.stackOrder = TILE_STACK_ORDER.Bottom;
		server.hasStackOrder = true;
	} else if (thing.isOnTop) {
		server.stackOrder = TILE_STACK_ORDER.Top;
		server.hasStackOrder = true;
	} else {
		server.stackOrder = TILE_STACK_ORDER.None;
		server.hasStackOrder = false;
	}

	if (thing.marketName && thing.marketName.length > 0) {
		server.name = thing.marketName;
	}
	if (thing.marketTradeAs !== 0) {
		server.tradeAs = thing.marketTradeAs;
	}
}

export function createServerItemFromThing(thing: ThingType, serverId: number, clientVersion: number): ServerItem {
	const item = createServerItem(serverId, thing.id);
	syncFromThingType(item, thing, true, clientVersion);
	item.spriteHash = new Array(16).fill(0);
	return item;
}

export interface OtbReconcileResult {
	synced: number;
	created: number;
}

export function thingHasSprites(thing: ThingType): boolean {
	if ((thing.spriteIndex ?? []).some((id) => id > 0)) return true;
	for (const g of thing.frameGroupsData ?? []) {
		if ((g.spriteIndex ?? []).some((id) => id > 0)) return true;
	}
	return false;
}

export function reconcileServerItems(data: AssetData, autoSync: boolean, clientVersion: number): OtbReconcileResult {
	const sd = data.serverItems;
	if (!sd) return { synced: 0, created: 0 };

	let maxServerId = 0;
	for (const id of sd.items.keys()) if (id > maxServerId) maxServerId = id;

	let created = 0;
	let synced = 0;

	for (const thing of data.items.values()) {
		const serverIds = sd.byClientId.get(thing.id);
		if (serverIds && serverIds.length > 0) {
			if (autoSync) {
				for (const sid of serverIds) {
					const server = sd.items.get(sid);
					if (server) {
						syncFromThingType(server, thing, false, clientVersion);
						synced++;
					}
				}
			}
		} else if (thingHasSprites(thing)) {
			const newItem = createServerItemFromThing(thing, ++maxServerId, clientVersion);
			sd.items.set(newItem.serverId, newItem);
			sd.byClientId.set(thing.id, [newItem.serverId]);
			created++;
		}
	}

	return { synced, created };
}

function escapeXml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hasXmlData(item: ServerItem): boolean {
	return !!(
		(item.nameXml && item.nameXml.length > 0) ||
		(item.article && item.article.length > 0) ||
		(item.plural && item.plural.length > 0) ||
		(item.xmlAttributes && item.xmlAttributes.length > 0)
	);
}

function writeAttrs(attrs: XmlAttr[], indent: string): string {
	let out = '';
	for (const attr of attrs) {
		const valuePart = attr.hasValue === false ? '' : ` value="${escapeXml(attr.value)}"`;
		let extraPart = '';
		for (const [k, v] of attr.extra ?? []) extraPart += ` ${k}="${escapeXml(v)}"`;
		if (attr.children && attr.children.length > 0) {
			out += `${indent}<attribute key="${escapeXml(attr.key)}"${valuePart}${extraPart}>\n`;
			out += writeAttrs(attr.children, indent + '\t');
			out += `${indent}</attribute>\n`;
		} else {
			out += `${indent}<attribute key="${escapeXml(attr.key)}"${valuePart}${extraPart} />\n`;
		}
	}
	return out;
}

function attrSig(a: XmlAttr): unknown[] {
	return [a.tag ? 1 : 0, a.key, a.hasValue === false ? null : a.value, a.extra ?? [], (a.children ?? []).map(attrSig)];
}

function entrySig(nameXml?: string, article?: string, plural?: string, attrs?: XmlAttr[]): string {
	return JSON.stringify([nameXml ?? '', article ?? '', plural ?? '', (attrs ?? []).map(attrSig)]);
}

function xmlSignature(item: ServerItem): string {
	return entrySig(item.nameXml, item.article, item.plural, item.xmlAttributes);
}

function entrySigOf(e: ItemsXmlEntry): string {
	return entrySig(e.nameXml, e.article, e.plural, e.attributes);
}

function writeItemTag(start: ServerItem, end: null | ServerItem): string {
	let tag = '\t<item';
	if (end && end.serverId !== start.serverId) {
		tag += ` fromid="${start.serverId}" toid="${end.serverId}"`;
	} else {
		tag += ` id="${start.serverId}"`;
	}
	if (start.article && start.article.length > 0) tag += ` article="${escapeXml(start.article)}"`;
	if (start.nameXml != null) tag += ` name="${escapeXml(start.nameXml)}"`;
	if (start.plural && start.plural.length > 0) tag += ` plural="${escapeXml(start.plural)}"`;

	const all = start.xmlAttributes ?? [];
	for (const attr of all) {
		if (attr.tag) tag += ` ${attr.key}="${escapeXml(attr.value)}"`;
	}

	const children = all.filter((a) => !a.tag);
	if (children.length > 0) {
		tag += '>\n';
		tag += writeAttrs(children, '\t\t');
		tag += '\t</item>\n';
	} else {
		tag += ' />\n';
	}
	return tag;
}

function orphanToServerItem(id: number, entry: ItemsXmlEntry): ServerItem {
	const item = createServerItem(id, 0);
	item.nameXml = entry.nameXml;
	item.article = entry.article;
	item.plural = entry.plural;
	item.xmlAttributes = entry.attributes.length > 0 ? entry.attributes : undefined;
	return item;
}

function serializeItemRun(items: ServerItem[]): string {
	const sorted = [...items].sort((a, b) => a.serverId - b.serverId);

	let body = '';
	let i = 0;
	while (i < sorted.length) {
		const item = sorted[i];
		if (!hasXmlData(item)) {
			i++;
			continue;
		}

		const sig = xmlSignature(item);
		const hasChildren = (item.xmlAttributes?.length ?? 0) > 0;
		let end = i;
		if (!hasChildren) {
			while (
				end + 1 < sorted.length &&
				sorted[end + 1].serverId === sorted[end].serverId + 1 &&
				hasXmlData(sorted[end + 1]) &&
				(sorted[end + 1].xmlAttributes?.length ?? 0) === 0 &&
				xmlSignature(sorted[end + 1]) === sig
			) {
				end++;
			}
		}

		body += writeItemTag(item, end > i ? sorted[end] : null);
		i = end + 1;
	}

	return body;
}

export function serializeItemsXml(items: ServerItem[], profileId?: string): string {
	const body = serializeItemRun(items);
	const marker = profileId ? `\t<!-- sprite-forge: profile=${profileId} -->\n` : '';
	return `<?xml version="1.0" encoding="UTF-8"?>\n<items>\n${marker}${body}</items>\n`;
}

interface XmlItemSpan {
	end: number;
	start: number;
	ids: number[];
}

function scanItemSpans(raw: string): XmlItemSpan[] {
	const spans: XmlItemSpan[] = [];
	let i = 0;
	while (i < raw.length) {
		const lt = raw.indexOf('<', i);
		if (lt === -1) break;
		if (raw.startsWith('<!--', lt)) {
			const end = raw.indexOf('-->', lt);
			i = end === -1 ? raw.length : end + 3;
			continue;
		}
		if (/^<item[\s/>]/.test(raw.slice(lt, lt + 6))) {
			const tagEnd = raw.indexOf('>', lt);
			if (tagEnd === -1) break;
			const selfClose = raw[tagEnd - 1] === '/';
			let end = tagEnd + 1;
			if (!selfClose) {
				const close = raw.indexOf('</item>', tagEnd);
				end = close === -1 ? tagEnd + 1 : close + '</item>'.length;
			}
			const head = raw.slice(lt, tagEnd + 1);
			const id = head.match(/\bid\s*=\s*["'](\d+)["']/);
			const from = head.match(/\bfromid\s*=\s*["'](\d+)["']/);
			const to = head.match(/\btoid\s*=\s*["'](\d+)["']/);
			const ids: number[] = [];
			if (id) {
				ids.push(parseInt(id[1], 10));
			} else if (from && to) {
				const f = parseInt(from[1], 10);
				const t = parseInt(to[1], 10);
				if (t >= f && t - f < 100000) for (let x = f; x <= t; x++) ids.push(x);
			}
			spans.push({ ids, end, start: lt });
			i = end;
			continue;
		}
		i = lt + 1;
	}
	return spans;
}

function expandToLine(raw: string, start: number, end: number): [number, number] {
	let a = start;
	while (a > 0 && (raw[a - 1] === ' ' || raw[a - 1] === '\t')) a--;
	if (a > 0 && raw[a - 1] !== '\n') a = start;
	let b = end;
	while (b < raw.length && (raw[b] === ' ' || raw[b] === '\t')) b++;
	if (raw[b] === '\r' && raw[b + 1] === '\n') b += 2;
	else if (raw[b] === '\n') b += 1;
	else b = end;
	return [a, b];
}

export function patchItemsXml(
	raw: string,
	original: Map<number, ItemsXmlEntry>,
	current: Map<number, ServerItem>,
	orphans: undefined | Map<number, ItemsXmlEntry>,
	profileId?: string
): null | string {
	const desired = new Map<number, { sig: string; item: ServerItem }>();
	for (const item of current.values()) {
		if (hasXmlData(item)) desired.set(item.serverId, { item, sig: xmlSignature(item) });
	}
	if (orphans) {
		for (const [id, entry] of orphans) {
			if (desired.has(id) || current.has(id)) continue;
			const item = orphanToServerItem(id, entry);
			if (hasXmlData(item)) desired.set(id, { item, sig: entrySigOf(entry) });
		}
	}

	const spans = scanItemSpans(raw);
	const covered = new Set<number>();
	const edits: { end: number; text: string; start: number }[] = [];

	for (const span of spans) {
		if (span.ids.length === 0) continue;
		for (const id of span.ids) covered.add(id);
		const unchanged = span.ids.every((id) => {
			const o = original.get(id);
			const d = desired.get(id);
			return !!o && !!d && d.sig === entrySigOf(o);
		});
		if (unchanged) continue;
		const keep = span.ids.filter((id) => desired.has(id)).map((id) => desired.get(id)!.item);
		const [a, b] = expandToLine(raw, span.start, span.end);
		edits.push({ end: b, start: a, text: serializeItemRun(keep) });
	}

	const fresh = [...desired.keys()].filter((id) => !covered.has(id)).sort((a, b) => a - b);
	if (fresh.length > 0) {
		const closeIdx = raw.lastIndexOf('</items>');
		if (closeIdx === -1) return null;
		const [a] = expandToLine(raw, closeIdx, closeIdx);
		edits.push({ end: a, start: a, text: serializeItemRun(fresh.map((id) => desired.get(id)!.item)) });
	}

	edits.sort((x, y) => x.start - y.start || x.end - y.end);
	let out = '';
	let pos = 0;
	for (const e of edits) {
		if (e.start < pos) return null;
		out += raw.slice(pos, e.start) + e.text;
		pos = e.end;
	}
	out += raw.slice(pos);

	if (profileId) {
		const line = `<!-- sprite-forge: profile=${profileId} -->`;
		const m = out.match(PROFILE_MARKER);
		if (m) {
			if (m[1] !== profileId) out = out.replace(PROFILE_MARKER, line);
		} else {
			const open = out.match(/<items[^>]*>/);
			if (!open) return null;
			out = out.replace(open[0], `${open[0]}\n\t${line}`);
		}
	}

	try {
		const reparsed = parseItemsXml(out);
		if (reparsed.size !== desired.size) return null;
		for (const [id, d] of desired) {
			const e = reparsed.get(id);
			if (!e || entrySigOf(e) !== d.sig) return null;
		}
	} catch {
		return null;
	}

	return out;
}

export async function writeItemsXml(path: string, items: ServerItem[], profileId?: string): Promise<void> {
	const content = serializeItemsXml(items, profileId);
	await invoke('write_json_file', { path, content });
}

export async function compileServerItems(
	data: AssetData,
	autoSync: boolean,
	clientVersion: number,
	confirmXmlRewrite?: () => Promise<boolean>
): Promise<OtbReconcileResult> {
	const sd = data.serverItems;
	if (!sd) return { synced: 0, created: 0 };

	const result = reconcileServerItems(data, autoSync, clientVersion);

	const items = Array.from(sd.items.values());
	await writeOtbFile(sd.otbPath, sd.meta, items);
	if (sd.xmlPath && (sd.xmlExisted || items.some(hasXmlData))) {
		let content: null | string = null;
		if (sd.xmlRaw != null && sd.xmlOriginal) {
			content = patchItemsXml(sd.xmlRaw, sd.xmlOriginal, sd.items, sd.xmlOrphans, sd.profileId);
		}
		if (content == null) {
			if (sd.xmlExisted) {
				const ok = confirmXmlRewrite ? await confirmXmlRewrite() : false;
				if (!ok) return result;
			}
			const xmlItems = [...items];
			if (sd.xmlOrphans) {
				for (const [id, entry] of sd.xmlOrphans) {
					if (sd.items.has(id)) continue;
					xmlItems.push(orphanToServerItem(id, entry));
				}
			}
			content = serializeItemsXml(xmlItems, sd.profileId);
		}
		await invoke('write_json_file', { content, path: sd.xmlPath });
		sd.xmlRaw = content;
		sd.xmlExisted = true;
		try {
			sd.xmlOriginal = parseItemsXml(content);
		} catch {
			sd.xmlOriginal = undefined;
		}
	}

	return result;
}
