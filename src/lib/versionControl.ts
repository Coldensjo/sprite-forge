/**
 * Version Control System for Sprite Forge
 * Tracks changes to items and sprites with git-like commits
 */

import { invoke } from '@tauri-apps/api/core';

import { Sprite, ThingType, ThingCategory } from './tibia/types';

/**
 * Represents a single commit with all changes
 */
export interface Commit {
	hash: string;
	message: string;
	timestamp: number;
	changedItems: Array<{
		id: number;
		data: ThingType;
		category: ThingCategory;
	}>;
	changedSprites: Array<{
		id: number;
		transparent: boolean;
		compressedPixels: string; // base64-encoded
	}>;
}

/**
 * Commit log metadata
 */
export interface CommitLog {
	commits: Array<{
		hash: string;
		message: string;
		timestamp: number;
		itemCount: number;
		spriteCount: number;
	}>;
}

/**
 * Generate a hash for a commit
 */
function generateCommitHash(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2);
	return `${timestamp}-${random}`;
}

/**
 * Encode Uint8Array to base64 string
 */
function encodeBase64(data: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < data.length; i++) {
		binary += String.fromCharCode(data[i]);
	}
	return btoa(binary);
}

/**
 * Decode base64 string to Uint8Array
 */
function decodeBase64(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Get the versions directory path
 */
async function getVersionsDir(): Promise<string> {
	const configDir = await invoke<string>('get_config_dir_path');
	return `${configDir}/versions`;
}

/**
 * Get the commits log path
 */
async function getCommitsLogPath(): Promise<string> {
	const versionsDir = await getVersionsDir();
	return `${versionsDir}/commits.json`;
}

/**
 * Get the commit file path for a specific commit hash
 */
async function getCommitPath(hash: string): Promise<string> {
	const versionsDir = await getVersionsDir();
	return `${versionsDir}/${hash}.json`;
}

/**
 * Create a new commit with changed items and sprites
 */
export async function createCommit(
	message: string,
	changedItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>,
	changedSprites: Map<number, Sprite>
): Promise<Commit> {
	const hash = generateCommitHash();
	const timestamp = Date.now();

	// Convert changed items map to array
	const itemsArray = Array.from(changedItems.values()).map((item) => ({
		id: item.id,
		category: item.category,
		data: JSON.parse(JSON.stringify(item.data)) // Deep clone
	}));

	// Convert changed sprites map to array with base64-encoded pixels
	const spritesArray = Array.from(changedSprites.values()).map((sprite) => ({
		id: sprite.id,
		transparent: sprite.transparent,
		compressedPixels: encodeBase64(sprite.compressedPixels)
	}));

	const commit: Commit = {
		hash,
		message,
		timestamp,
		changedItems: itemsArray,
		changedSprites: spritesArray
	};

	// Ensure versions directory exists
	await invoke('ensure_versions_dir');

	// Save commit to file
	const commitPath = await getCommitPath(hash);
	await invoke('write_json_file', {
		path: commitPath,
		content: JSON.stringify(commit, null, 2)
	});

	// Update commits log
	await updateCommitLog(hash, timestamp, message, itemsArray.length, spritesArray.length);

	return commit;
}

/**
 * Update the commits log with a new commit
 */
async function updateCommitLog(
	hash: string,
	timestamp: number,
	message: string,
	itemCount: number,
	spriteCount: number
): Promise<void> {
	const logPath = await getCommitsLogPath();

	let log: CommitLog;
	try {
		const content = await invoke<string>('read_file_text', { path: logPath });
		log = JSON.parse(content);
	} catch (e) {
		// If log doesn't exist, create a new one
		log = { commits: [] };
	}

	// Add new commit to the beginning (newest first)
	log.commits.unshift({
		hash,
		message,
		timestamp,
		itemCount,
		spriteCount
	});

	// Save updated log
	await invoke('write_json_file', {
		path: logPath,
		content: JSON.stringify(log, null, 2)
	});
}

/**
 * Get the commit history
 */
export async function getCommitHistory(): Promise<CommitLog> {
	const logPath = await getCommitsLogPath();

	try {
		const content = await invoke<string>('read_file_text', { path: logPath });
		return JSON.parse(content);
	} catch (e) {
		// If log doesn't exist, return empty log
		return { commits: [] };
	}
}

/**
 * Get a specific commit's full state
 */
export async function getCommitState(hash: string): Promise<null | Commit> {
	const commitPath = await getCommitPath(hash);

	try {
		const content = await invoke<string>('read_file_text', { path: commitPath });
		const commit: Commit = JSON.parse(content);

		// Decode base64 sprite data back to Uint8Array (for use in-memory)
		// Note: This is kept as base64 in the JSON for serialization
		return commit;
	} catch (e) {
		console.error(`Failed to load commit ${hash}:`, e);
		return null;
	}
}

/**
 * Clean old versions
 * @param options - Cleanup options
 * @param options.keepLast - Number of recent commits to keep
 * @param options.olderThanDays - Delete commits older than this many days
 */
export async function cleanOldVersions(options: { keepLast?: number; olderThanDays?: number }): Promise<number> {
	const log = await getCommitHistory();
	const commitsToDelete: string[] = [];

	const now = Date.now();
	const msPerDay = 24 * 60 * 60 * 1000;

	for (let i = 0; i < log.commits.length; i++) {
		const commit = log.commits[i];
		let shouldDelete = false;

		// Check if we should keep based on position (keep last N)
		if (options.keepLast !== undefined && i >= options.keepLast) {
			shouldDelete = true;
		}

		// Check if we should delete based on age
		if (options.olderThanDays !== undefined) {
			const age = (now - commit.timestamp) / msPerDay;
			if (age > options.olderThanDays) {
				shouldDelete = true;
			}
		}

		if (shouldDelete) {
			commitsToDelete.push(commit.hash);
		}
	}

	// Delete commit files
	for (const hash of commitsToDelete) {
		const commitPath = await getCommitPath(hash);
		try {
			await invoke('delete_file', { path: commitPath });
		} catch (e) {
			console.error(`Failed to delete commit file ${hash}:`, e);
		}
	}

	// Update log to remove deleted commits
	if (commitsToDelete.length > 0) {
		const updatedLog: CommitLog = {
			commits: log.commits.filter((c) => !commitsToDelete.includes(c.hash))
		};

		const logPath = await getCommitsLogPath();
		await invoke('write_json_file', {
			path: logPath,
			content: JSON.stringify(updatedLog, null, 2)
		});
	}

	return commitsToDelete.length;
}

/**
 * Decode sprite data from a commit for use
 */
export function decodeCommitSpriteData(encodedPixels: string): Uint8Array {
	return decodeBase64(encodedPixels);
}
