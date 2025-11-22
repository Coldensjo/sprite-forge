#!/usr/bin/env node
/**
 * Quick log checker - shows if logs are being generated
 */

import * as fs from 'fs';
import * as path from 'path';

const RUST_LOG_TAURI = path.join(process.cwd(), 'src-tauri', 'sprite-forge-debug.jsonl');
const RUST_LOG_ROOT = path.join(process.cwd(), 'sprite-forge-debug.jsonl');

console.log('🔍 Checking debug logs...\n');
console.log('📍 Log locations:');
console.log(`   Backend: ${RUST_LOG_TAURI} (or ${RUST_LOG_ROOT})`);
console.log(`   Frontend: Browser localStorage (key: sprite-forge-debug)\n`);

// Check Rust backend logs (check both locations)
const RUST_LOG = fs.existsSync(RUST_LOG_TAURI) ? RUST_LOG_TAURI : fs.existsSync(RUST_LOG_ROOT) ? RUST_LOG_ROOT : null;

if (RUST_LOG) {
	const content = fs.readFileSync(RUST_LOG, 'utf-8');
	const lines = content.split('\n').filter((l) => l.trim());

	if (lines.length === 0) {
		console.log('⚠️  Backend log file exists but is empty');
		console.log('   Run the app to generate logs\n');
	} else {
		const first = JSON.parse(lines[0]);
		const last = JSON.parse(lines[lines.length - 1]);
		const duration = (last.t - first.t) / 1000;

		console.log('✓ Backend logs found');
		console.log(`  File: ${RUST_LOG}`);
		console.log(`  Entries: ${lines.length}`);
		console.log(`  Duration: ${duration.toFixed(2)}s`);
		console.log(`  Last event: ${last.e} at ${new Date(last.t).toLocaleTimeString()}\n`);

		// Count event types
		const events: Record<string, number> = {};
		for (const line of lines) {
			const entry = JSON.parse(line);
			events[entry.e] = (events[entry.e] || 0) + 1;
		}

		console.log('Event breakdown:');
		for (const [event, count] of Object.entries(events).sort((a, b) => b[1] - a[1])) {
			console.log(`  ${event}: ${count}`);
		}
	}
} else {
	console.log('❌ Backend log file not found');
	console.log(`   Expected: ${RUST_LOG_TAURI}`);
	console.log(`   Or: ${RUST_LOG_ROOT}`);
	console.log('   Run the app to generate logs\n');
}

console.log('\n💡 Next steps:');
console.log('   1. Run: npm run logs:save');
console.log('   2. Check: sprite-forge-debug-summary.txt');
console.log('   3. Share summary with AI (not raw logs!)\n');
