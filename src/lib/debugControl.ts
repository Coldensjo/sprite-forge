/**
 * Debug Logging Control
 *
 * Functions to enable/disable debug logging from both frontend and backend
 */

import { invoke } from '@tauri-apps/api/core';

import { logger } from './debug';

/**
 * Enable/disable frontend logging (localStorage)
 */
export function setFrontendLogging(enabled: boolean): void {
	logger.setEnabled(enabled);
}

/**
 * Enable/disable backend logging (Rust file logging)
 */
export async function setBackendLogging(enabled: boolean): Promise<void> {
	await invoke('set_debug_logging', { enabled });
}

/**
 * Enable/disable ALL logging (both frontend and backend)
 */
export async function setDebugLogging(enabled: boolean): Promise<void> {
	setFrontendLogging(enabled);
	await setBackendLogging(enabled);
}

/**
 * Check if frontend logging is enabled
 */
export function isFrontendLoggingEnabled(): boolean {
	return logger.isEnabled();
}

/**
 * Check if backend logging is enabled
 */
export async function isBackendLoggingEnabled(): Promise<boolean> {
	return await invoke<boolean>('get_debug_logging');
}

/**
 * Get logging status for both frontend and backend
 */
export async function getLoggingStatus(): Promise<{ backend: boolean; frontend: boolean }> {
	const frontend = isFrontendLoggingEnabled();
	const backend = await isBackendLoggingEnabled();
	return { backend, frontend };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
	(window as any).__debugControl = {
		status: () => getLoggingStatus(),
		enable: () => setDebugLogging(true),
		disable: () => setDebugLogging(false),
		enableBackend: () => setBackendLogging(true),
		enableFrontend: () => setFrontendLogging(true),
		disableBackend: () => setBackendLogging(false),
		disableFrontend: () => setFrontendLogging(false)
	};
}
