#!/usr/bin/env node
/**
 * AI-Optimized Log Analyzer
 *
 * Parses JSONL debug logs and generates a compact summary for AI analysis.
 * Reduces 7000+ lines to ~50 lines of actionable insights.
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  t: number;
  e: string;
  d: Record<string, any>;
}

interface EventStats {
  count: number;
  firstTime: number;
  lastTime: number;
  samples: LogEntry[];
}

function analyzeLogs(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const entries: LogEntry[] = lines.map(l => JSON.parse(l));

  if (entries.length === 0) {
    return 'No log entries found';
  }

  // Group by event type
  const eventStats = new Map<string, EventStats>();

  for (const entry of entries) {
    if (!eventStats.has(entry.e)) {
      eventStats.set(entry.e, {
        count: 0,
        firstTime: entry.t,
        lastTime: entry.t,
        samples: [],
      });
    }

    const stats = eventStats.get(entry.e)!;
    stats.count++;
    stats.lastTime = entry.t;

    // Keep first 3 samples of each event type
    if (stats.samples.length < 3) {
      stats.samples.push(entry);
    }
  }

  // Build compact summary
  const output: string[] = [];
  const startTime = entries[0].t;
  const endTime = entries[entries.length - 1].t;
  const duration = endTime - startTime;

  output.push('=== LOG ANALYSIS SUMMARY ===');
  output.push(`Total entries: ${entries.length}`);
  output.push(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  output.push(`Time range: ${new Date(startTime).toISOString()} - ${new Date(endTime).toISOString()}`);
  output.push('');

  // Event type breakdown
  output.push('=== EVENT BREAKDOWN ===');
  const sortedEvents = Array.from(eventStats.entries()).sort((a, b) => b[1].count - a[1].count);

  for (const [event, stats] of sortedEvents) {
    const rate = (stats.count / (duration / 1000)).toFixed(2);
    output.push(`${event}: ${stats.count} events (${rate}/s)`);
  }
  output.push('');

  // Context cache analysis
  const spriteReqs = entries.filter(e => e.e === 'CTX_SPRITE_REQ');
  const spriteHits = entries.filter(e => e.e === 'CTX_SPRITE_HIT');
  const spriteMisses = entries.filter(e => e.e === 'CTX_SPRITE_MISS');

  if (spriteReqs.length > 0) {
    output.push('=== SPRITE CACHE PERFORMANCE ===');
    output.push(`Total requests: ${spriteReqs.length}`);
    output.push(`Cache hits: ${spriteHits.length} (${((spriteHits.length / spriteReqs.length) * 100).toFixed(1)}%)`);
    output.push(`Cache misses: ${spriteMisses.length} (${((spriteMisses.length / spriteReqs.length) * 100).toFixed(1)}%)`);

    // Analyze miss patterns
    if (spriteMisses.length > 0) {
      const missedIds = spriteMisses.map(e => e.d.id);
      const uniqueMisses = new Set(missedIds);
      output.push(`Unique missed sprites: ${uniqueMisses.size}`);
      output.push(`Most missed: ${Array.from(uniqueMisses).slice(0, 10).join(', ')}`);
    }
    output.push('');
  }

  // Batch loading analysis
  const batchLoads = entries.filter(e => e.e === 'ITEM_LOAD_BATCH');
  if (batchLoads.length > 0) {
    output.push('=== BATCH LOADING ===');
    output.push(`Total batch loads: ${batchLoads.length}`);

    const totalSprites = batchLoads.reduce((sum, e) => sum + (e.d.n || 0), 0);
    const totalWindows = batchLoads.reduce((sum, e) => sum + (e.d.w || 0), 0);

    output.push(`Total sprites loaded: ${totalSprites}`);
    output.push(`Total windows: ${totalWindows}`);
    output.push(`Avg sprites/batch: ${(totalSprites / batchLoads.length).toFixed(1)}`);
    output.push('');
  }

  // Rust backend analysis
  const sprOpen = entries.filter(e => e.e === 'SPR_OPEN');
  const sprRead = entries.filter(e => e.e === 'SPR_READ');
  const sprBatch = entries.filter(e => e.e === 'SPR_BATCH');

  if (sprOpen.length > 0 || sprRead.length > 0 || sprBatch.length > 0) {
    output.push('=== RUST BACKEND ===');
    output.push(`SPR files opened: ${sprOpen.length}`);
    output.push(`Single sprite reads: ${sprRead.length}`);
    output.push(`Batch reads: ${sprBatch.length}`);

    if (sprBatch.length > 0) {
      const totalRead = sprBatch.reduce((sum, e) => sum + (e.d.ok || 0), 0);
      output.push(`Total sprites via batch: ${totalRead}`);
      output.push(`Avg sprites/batch: ${(totalRead / sprBatch.length).toFixed(1)}`);
    }
    output.push('');
  }

  // Loader analysis (NEW)
  const loaderWindow = entries.filter(e => e.e === 'LOADER_WINDOW');
  const loaderCached = entries.filter(e => e.e === 'LOADER_CACHED');
  const loaderRead = entries.filter(e => e.e === 'LOADER_READ');
  const loaderAdded = entries.filter(e => e.e === 'LOADER_ADDED');
  const loaderEvict = entries.filter(e => e.e === 'LOADER_EVICT');

  if (loaderWindow.length > 0) {
    output.push('=== SPRITE LOADER ===');
    output.push(`Window requests: ${loaderWindow.length}`);
    output.push(`Cache hits: ${loaderCached.length} (${((loaderCached.length / loaderWindow.length) * 100).toFixed(1)}%)`);
    output.push(`Actual reads: ${loaderRead.length}`);

    if (loaderAdded.length > 0) {
      const totalAdded = loaderAdded.reduce((sum, e) => sum + (e.d.n || 0), 0);
      output.push(`Sprites loaded: ${totalAdded}`);
      output.push(`Avg sprites/read: ${(totalAdded / loaderRead.length).toFixed(1)}`);
    }

    if (loaderEvict.length > 0) {
      const totalEvicted = loaderEvict.reduce((sum, e) => sum + (e.d.rm || 0), 0);
      output.push(`Cache evictions: ${loaderEvict.length} (${totalEvicted} sprites removed)`);
    }
    output.push('');
  }

  // Canvas rendering analysis
  const canvasDraws = entries.filter(e => e.e === 'CANVAS_DRAW');
  const withMisses = canvasDraws.filter(e => e.d.miss === true);

  if (canvasDraws.length > 0) {
    output.push('=== CANVAS RENDERING ===');
    output.push(`Total draws: ${canvasDraws.length}`);
    output.push(`Draws with missing sprites: ${withMisses.length} (${((withMisses.length / canvasDraws.length) * 100).toFixed(1)}%)`);

    if (duration > 0) {
      const fps = (canvasDraws.length / (duration / 1000)).toFixed(2);
      output.push(`Render rate: ${fps} draws/s`);
    }
    output.push('');
  }

  // Error analysis
  const errors = entries.filter(e => e.e === 'ERROR');
  if (errors.length > 0) {
    output.push('=== ERRORS ===');
    output.push(`Total errors: ${errors.length}`);

    for (const error of errors.slice(0, 5)) {
      output.push(`  - ${error.d.msg}: ${error.d.err}`);
    }

    if (errors.length > 5) {
      output.push(`  ... and ${errors.length - 5} more`);
    }
    output.push('');
  }

  // Performance insights
  output.push('=== PERFORMANCE INSIGHTS ===');

  const cacheHitRate = spriteReqs.length > 0 ? (spriteHits.length / spriteReqs.length) * 100 : 0;
  if (cacheHitRate < 50) {
    output.push('⚠️  LOW CACHE HIT RATE: Consider pre-loading more sprites');
  } else if (cacheHitRate > 90) {
    output.push('✓ Good cache hit rate');
  }

  const missRate = canvasDraws.length > 0 ? (withMisses.length / canvasDraws.length) * 100 : 0;
  if (missRate > 10) {
    output.push('⚠️  HIGH MISS RATE IN RENDERS: Sprites not loaded before render');
  } else {
    output.push('✓ Low missing sprite rate in renders');
  }

  if (canvasDraws.length > 1000 && duration < 1000) {
    output.push('⚠️  HIGH RENDER FREQUENCY: Possible render loop issue');
  }

  output.push('');

  // Sample events (for debugging)
  output.push('=== SAMPLE EVENTS (first 3 of each type) ===');
  for (const [event, stats] of sortedEvents.slice(0, 5)) {
    output.push(`${event}:`);
    for (const sample of stats.samples) {
      output.push(`  ${JSON.stringify(sample.d)}`);
    }
  }

  return output.join('\n');
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const saveFlag = args.includes('--save');
  const fileArg = args.find(arg => !arg.startsWith('--'));

  // Default path: check src-tauri directory first (where Tauri runs), then project root
  let defaultPath = path.join(process.cwd(), 'src-tauri', 'sprite-forge-debug.jsonl');
  if (!fs.existsSync(defaultPath)) {
    defaultPath = path.join(process.cwd(), 'sprite-forge-debug.jsonl');
  }

  const filePath = fileArg || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    console.error('Usage: bun run scripts/analyze-logs.ts [path-to-jsonl-file] [--save]');
    console.error(`\nNote: Backend logs should be in one of these locations:`);
    console.error(`  - ${path.join(process.cwd(), 'src-tauri', 'sprite-forge-debug.jsonl')} (most common)`);
    console.error(`  - ${path.join(process.cwd(), 'sprite-forge-debug.jsonl')}`);
    console.error('\nFrontend logs are in browser localStorage (use window.__debugLogger.downloadLogs())');
    process.exit(1);
  }

  const summary = analyzeLogs(filePath);
  console.log(summary);

  // Optionally save to file
  if (saveFlag) {
    const outputPath = filePath.replace('.jsonl', '-summary.txt');
    fs.writeFileSync(outputPath, summary);
    console.log(`\nSummary saved to: ${outputPath}`);
  }
}

export { analyzeLogs };
