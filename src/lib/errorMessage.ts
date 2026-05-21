export function errorToString(err: unknown): string {
	if (err == null) return 'Unknown error';
	if (typeof err === 'string') return err;
	if (err instanceof Error) {
		return err.stack && err.stack.includes(err.message) ? err.stack : err.stack ? `${err.message}\n${err.stack}` : err.message;
	}
	if (typeof err === 'object') {
		const obj = err as Record<string, unknown>;
		if (typeof obj.message === 'string') return obj.message;
		try {
			return JSON.stringify(err, null, 2);
		} catch {
			return String(err);
		}
	}
	return String(err);
}
