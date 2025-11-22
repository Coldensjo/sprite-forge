/**
 * AI-Optimized Debug Logger
 *
 * Token-efficient logging system that writes structured JSONL to localStorage.
 * Minimal console output - only errors and critical events.
 */

// Event codes (matches Rust logger)
export enum EventCode {
	// Errors
	ERROR = 'ERROR',
	ITEM_PAGE = 'ITEM_PAGE',
	// Component events
	ITEM_MOUNT = 'ITEM_MOUNT',
	// Canvas events
	CANVAS_DRAW = 'CANVAS_DRAW',
	LOADER_READ = 'LOADER_READ',

	CTX_LOAD_END = 'CTX_LOAD_END',
	ITEM_UNMOUNT = 'ITEM_UNMOUNT',
	SPRITE_MOUNT = 'SPRITE_MOUNT',
	SPRITE_EMPTY = 'SPRITE_EMPTY',

	LOADER_ADDED = 'LOADER_ADDED',
	LOADER_EVICT = 'LOADER_EVICT',
	SPRITE_RENDER = 'SPRITE_RENDER',
	// Loader events
	LOADER_WINDOW = 'LOADER_WINDOW',

	LOADER_CACHED = 'LOADER_CACHED',
	// Context events
	CTX_LOAD_START = 'CTX_LOAD_START',

	CTX_SPRITE_REQ = 'CTX_SPRITE_REQ',
	CTX_SPRITE_HIT = 'CTX_SPRITE_HIT',
	SPRITE_UNMOUNT = 'SPRITE_UNMOUNT',
	CTX_SPRITE_MISS = 'CTX_SPRITE_MISS',
	ITEM_LOAD_BATCH = 'ITEM_LOAD_BATCH',

	CANVAS_DECOMPRESS = 'CANVAS_DECOMPRESS'
}

interface LogEntry {
	t: number; // timestamp (ms)
	e: EventCode; // event code
	d: Record<string, unknown>; // data
}

class DebugLogger {
	private storageKey = 'sprite-forge-debug';
	private enabledKey = 'sprite-forge-debug-enabled';
	private maxEntries = 10000; // Keep last 10k entries
	private consoleEnabled = false; // Only show console for errors
	private enabled = true; // Logging enabled by default
	private buffer: LogEntry[] = []; // Buffer for batch writing
	private flushIntervalId?: number;
	private flushIntervalMs = 1000; // Flush every 1 second
	private maxBufferSize = 100; // Flush if buffer reaches 100 entries

	constructor() {
		// Load enabled state from localStorage
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(this.enabledKey);
			this.enabled = saved === null ? true : saved === '1';

			// Set up auto-flush timer
			this.flushIntervalId = window.setInterval(() => {
				this.flush();
			}, this.flushIntervalMs);
		}
	}

	/**
	 * Log an event (buffered write to localStorage)
	 */
	log(event: EventCode, data: Record<string, unknown> = {}) {
		try {
			// Skip if logging disabled
			if (!this.enabled) return;

			// Sanitize data to ensure it's serializable (remove any functions, circular refs, etc.)
			const sanitizedData: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(data)) {
				// Only include primitive values and simple objects
				if (value === null || value === undefined) {
					sanitizedData[key] = value;
				} else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
					sanitizedData[key] = value;
				} else if (Array.isArray(value)) {
					sanitizedData[key] = value.map((v) => (typeof v === 'object' && v !== null ? '[object]' : v));
				} else if (typeof value === 'object') {
					// For objects, just stringify the type to avoid circular refs
					sanitizedData[key] = '[object]';
				}
				// Skip functions and other non-serializable types
			}

			const entry: LogEntry = {
				e: event,
				t: Date.now(),
				d: sanitizedData
			};

			// Add to buffer
			this.buffer.push(entry);

			// Flush if buffer is full
			if (this.buffer.length >= this.maxBufferSize) {
				this.flush();
			}

			// Console output only for errors
			if (this.consoleEnabled || event === EventCode.ERROR) {
				console.log(`[${event}]`, sanitizedData);
			}
		} catch (e) {
			// Silently fail if logging causes errors (e.g., localStorage full, etc.)
			// Don't break the app if logging fails
		}
	}

	/**
	 * Flush buffered entries to localStorage
	 */
	private flush() {
		if (this.buffer.length === 0) return;

		try {
			if (typeof window === 'undefined' || !window.localStorage) {
				this.buffer = [];
				return;
			}

			const existing = localStorage.getItem(this.storageKey) || '';
			let lines = existing.split('\n').filter((l) => l.trim());

			// Append all buffered entries
			for (const entry of this.buffer) {
				lines.push(JSON.stringify(entry));
			}

			// Keep only last maxEntries
			if (lines.length > this.maxEntries) {
				lines = lines.slice(lines.length - this.maxEntries);
			}

			localStorage.setItem(this.storageKey, lines.join('\n'));
			this.buffer = [];
		} catch (e) {
			// Storage full or other error - clear and try again
			try {
				this.clearLogs();
			} catch {
				// Ignore errors when clearing
			}
			this.buffer = [];
		}
	}

	/**
	 * Get all logs as array
	 */
	getLogs(): LogEntry[] {
		try {
			const data = localStorage.getItem(this.storageKey) || '';
			return data
				.split('\n')
				.filter((l) => l.trim())
				.map((l) => JSON.parse(l));
		} catch {
			return [];
		}
	}

	/**
	 * Export logs as JSONL string
	 */
	exportLogs(): string {
		return localStorage.getItem(this.storageKey) || '';
	}

	/**
	 * Clear all logs
	 */
	clearLogs() {
		localStorage.removeItem(this.storageKey);
	}

	/**
	 * Enable/disable console output (for debugging the debugger)
	 */
	setConsoleEnabled(enabled: boolean) {
		this.consoleEnabled = enabled;
	}

	/**
	 * Enable/disable logging entirely
	 */
	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		localStorage.setItem(this.enabledKey, enabled ? '1' : '0');

		// Flush any remaining buffered entries before disabling
		if (!enabled) {
			this.flush();
		}
	}

	/**
	 * Check if logging is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Download logs as file
	 */
	downloadLogs() {
		const logs = this.exportLogs();
		const blob = new Blob([logs], { type: 'application/jsonl' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sprite-forge-debug-${Date.now()}.jsonl`;
		a.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * Get log statistics (for quick analysis)
	 */
	getStats() {
		const logs = this.getLogs();
		const stats: Record<string, number> = {};

		for (const log of logs) {
			stats[log.e] = (stats[log.e] || 0) + 1;
		}

		return {
			events: stats,
			total: logs.length,
			firstTimestamp: logs[0]?.t || 0,
			lastTimestamp: logs[logs.length - 1]?.t || 0,
			duration: logs.length > 0 ? logs[logs.length - 1].t - logs[0].t : 0
		};
	}
}

// Singleton instance
export const logger = new DebugLogger();

// Expose to window for console access
if (typeof window !== 'undefined') {
	(window as any).__debugLogger = logger;
}

// Helper functions for common patterns
export const logError = (message: string, error?: unknown) => {
	logger.log(EventCode.ERROR, {
		msg: message,
		err: error instanceof Error ? error.message : String(error)
	});
};

export const logContextEvent = (event: EventCode, data: Record<string, unknown> = {}) => {
	logger.log(event, data);
};

export const logComponentEvent = (component: string, event: string, data: Record<string, unknown> = {}) => {
	logger.log(event as EventCode, { cmp: component, ...data });
};
