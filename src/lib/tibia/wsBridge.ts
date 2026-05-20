import { invoke } from '@tauri-apps/api/core';

interface Pending {
	resolve: (payload: Uint8Array) => void;
	reject: (err: Error) => void;
}

let socket: WebSocket | null = null;
let connecting: Promise<WebSocket> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

async function getSocket(): Promise<WebSocket> {
	if (socket && socket.readyState === WebSocket.OPEN) return socket;
	if (connecting) return connecting;

	connecting = (async () => {
		const port = await invoke<number>('get_ws_bridge_port');
		const ws = new WebSocket(`ws://127.0.0.1:${port}`);
		ws.binaryType = 'arraybuffer';

		ws.onmessage = (ev: MessageEvent) => {
			const buf = new Uint8Array(ev.data as ArrayBuffer);
			if (buf.byteLength < 5) return;
			const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
			const id = view.getUint32(0, true);
			const status = view.getUint8(4);
			const payload = buf.subarray(5);

			const p = pending.get(id);
			if (!p) return;
			pending.delete(id);

			if (status === 0) {
				p.resolve(payload);
			} else {
				p.reject(new Error(new TextDecoder().decode(payload)));
			}
		};

		ws.onclose = () => {
			socket = null;
			connecting = null;
			for (const [, p] of pending) p.reject(new Error('ws bridge closed'));
			pending.clear();
		};

		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error('ws bridge connection failed'));
		});

		socket = ws;
		connecting = null;
		return ws;
	})();

	return connecting;
}

type WsParams = {
	path: string;
	startId?: number;
	count?: number;
	ids?: number[];
	transparent?: boolean;
};

async function request(cmd: string, params: WsParams): Promise<Uint8Array> {
	const ws = await getSocket();
	const id = nextId++;
	if (nextId > 0xffffffff) nextId = 1;

	return new Promise<Uint8Array>((resolve, reject) => {
		pending.set(id, { resolve, reject });
		ws.send(JSON.stringify({ id, cmd, ...params }));
	});
}

export function wsReadSpritesBatchRgba(
	path: string,
	startId: number,
	count: number,
	transparent: boolean
): Promise<Uint8Array> {
	return request('read_sprites_batch_rgba', { path, startId, count, transparent });
}

export function wsReadSpritesRgbaLz4(path: string, ids: number[], transparent: boolean): Promise<Uint8Array> {
	return request('read_sprites_rgba_lz4', { path, ids, transparent });
}

export function isWsBridgeEnabled(): boolean {
	return typeof window !== 'undefined' && (window as unknown as { __useWsBridge?: boolean }).__useWsBridge === true;
}
