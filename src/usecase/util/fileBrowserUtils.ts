export interface DirEntry {
	name: string;
	path: string;
	is_dir: boolean;
	size: null | number;
	modified_ms: null | number;
}

export interface DriveInfo {
	label: string;
	letter: string;
}

export interface FavoriteFolder {
	name: string;
	path: string;
}

export interface SystemDirectory {
	name: string;
	path: string;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
	day: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	month: '2-digit',
	minute: '2-digit'
});

export function pathString(segments: string[]): string {
	if (segments.length === 0) return '';
	if (segments.length === 1) {
		const seg = segments[0];
		return /^[A-Za-z]:$/.test(seg) ? seg + '\\' : seg;
	}
	const head = /^[A-Za-z]:$/.test(segments[0]) ? segments[0] + '\\' : segments[0];
	return [head, ...segments.slice(1)].join('\\').replace(/\\+/g, '\\');
}

export function pathSegments(p: string): string[] {
	return p.split(/[\\/]+/).filter(Boolean);
}

export function pathsEqual(a: string, b: string): boolean {
	const norm = (s: string) =>
		s
			.replace(/[\\/]+$/, '')
			.replace(/[\\/]+/g, '/')
			.toLowerCase();
	return norm(a) === norm(b);
}

export function driveLabel(letter: string, drives: DriveInfo[]): string {
	return drives.find((d) => d.letter === letter)?.label ?? letter;
}

export function getFolderName(path: string): string {
	const segs = pathSegments(path);
	return segs[segs.length - 1] || path;
}

export function formatModified(ms: null | number): string {
	if (ms === null) return '';
	return dateFmt.format(new Date(ms));
}

export function formatSize(bytes: null | number): string {
	if (bytes === null) return '';
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;
	const gb = mb / 1024;
	return `${gb.toFixed(1)} GB`;
}

export function entryType(entry: DirEntry): string {
	if (entry.is_dir) return 'File folder';
	const dot = entry.name.lastIndexOf('.');
	if (dot < 1) return 'File';
	return `${entry.name.slice(dot + 1).toUpperCase()} File`;
}

export function formatSignature(sig: number): string {
	return sig.toString(16).toUpperCase();
}
