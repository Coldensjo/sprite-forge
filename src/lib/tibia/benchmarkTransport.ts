import { invoke } from '@tauri-apps/api/core';

import { wsReadSpritesBatchRgba } from './wsBridge';

interface BenchOptions {
	startId?: number;
	count?: number;
	runs?: number;
	transparent?: boolean;
	warmup?: number;
}

interface BenchStats {
	transport: 'ipc' | 'ws';
	runs: number;
	bytes: number;
	min: number;
	max: number;
	mean: number;
	median: number;
	p95: number;
	mbPerSec: number;
}

function summarize(transport: 'ipc' | 'ws', samples: number[], bytes: number): BenchStats {
	const sorted = [...samples].sort((a, b) => a - b);
	const sum = sorted.reduce((a, b) => a + b, 0);
	const mean = sum / sorted.length;
	const median = sorted[Math.floor(sorted.length / 2)];
	const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
	const mbPerSec = bytes / 1024 / 1024 / (mean / 1000);
	return {
		transport,
		runs: sorted.length,
		bytes,
		min: +sorted[0].toFixed(2),
		max: +sorted[sorted.length - 1].toFixed(2),
		mean: +mean.toFixed(2),
		median: +median.toFixed(2),
		p95: +p95.toFixed(2),
		mbPerSec: +mbPerSec.toFixed(1)
	};
}

async function timeRuns(fn: () => Promise<Uint8Array>, runs: number, warmup: number): Promise<{ samples: number[]; bytes: number }> {
	let bytes = 0;
	for (let i = 0; i < warmup; i++) {
		const r = await fn();
		bytes = r.byteLength;
	}
	const samples: number[] = [];
	for (let i = 0; i < runs; i++) {
		const t0 = performance.now();
		const r = await fn();
		samples.push(performance.now() - t0);
		bytes = r.byteLength;
	}
	return { samples, bytes };
}

export async function benchmarkTransport(sprPath: string, opts: BenchOptions = {}): Promise<{ ipc: BenchStats; ws: BenchStats }> {
	const startId = opts.startId ?? 1;
	const count = opts.count ?? 500;
	const transparent = opts.transparent ?? false;
	const runs = opts.runs ?? 30;
	const warmup = opts.warmup ?? 5;

	const ipcFn = () => invoke<Uint8Array>('read_sprites_batch_rgba', { path: sprPath, startId, count, transparent });
	const wsFn = () => wsReadSpritesBatchRgba(sprPath, startId, count, transparent);

	console.log(`[bench] warming up (${warmup}) + ${runs} runs each, ${count} sprites from id ${startId}...`);

	const ipcRes = await timeRuns(ipcFn, runs, warmup);
	const wsRes = await timeRuns(wsFn, runs, warmup);

	const ipc = summarize('ipc', ipcRes.samples, ipcRes.bytes);
	const ws = summarize('ws', wsRes.samples, wsRes.bytes);

	console.table([ipc, ws]);
	const faster = ws.mean < ipc.mean ? 'WS' : 'IPC';
	const ratio = (Math.max(ws.mean, ipc.mean) / Math.min(ws.mean, ipc.mean)).toFixed(2);
	console.log(`[bench] ${faster} is faster by ${ratio}x on mean latency (payload ${(ipc.bytes / 1024 / 1024).toFixed(2)} MB).`);

	return { ipc, ws };
}

if (typeof window !== 'undefined') {
	(window as unknown as { __benchTransport?: typeof benchmarkTransport }).__benchTransport = benchmarkTransport;
}
